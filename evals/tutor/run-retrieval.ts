/**
 * Live retrieval evaluation against already indexed, authorized Tutor courses.
 * npx tsx evals/tutor/run-retrieval.ts dataset.json [--rerank]
 * Calls the configured embedding service; no fabricated scores or fixtures are
 * reported as product quality. Run on held-out documents after tuning.
 */
import { config as dotenvConfig } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'

import type { RetrievalTrace } from '../../lib/tutor/retrieval'

import { mean, percentile, retrievalMetrics } from './metrics'

dotenvConfig({ path: '.env.local', quiet: true })

const datasetSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      userId: z.string().min(1),
      courseId: z.string().min(1),
      query: z.string().min(1),
      relevantSourceIds: z.array(z.string()),
      split: z.enum(['validation', 'test']),
      tags: z.array(z.string()).default([])
    })
  )
  .min(1)

async function main() {
  const filename = process.argv[2]
  if (!filename || filename.startsWith('--'))
    throw new Error(
      'Usage: npx tsx evals/tutor/run-retrieval.ts dataset.json [--rerank]'
    )
  const cases = datasetSchema.parse(
    JSON.parse(await readFile(filename, 'utf8'))
  )
  if (new Set(cases.map(item => item.id)).size !== cases.length)
    throw new Error('Dataset IDs must be unique.')
  // Do not accidentally use the same course in validation and held-out tests.
  const courseSplits = new Map<string, string>()
  for (const item of cases) {
    const key = `${item.userId}:${item.courseId}`
    if (courseSplits.has(key) && courseSplits.get(key) !== item.split)
      throw new Error(
        'Validation and test splits must use different courses/documents.'
      )
    courseSplits.set(key, item.split)
  }
  const { retrieveEvidenceWithTrace } = await import(
    '../../lib/tutor/retrieval'
  )
  const { getCourseDocuments } = await import('../../lib/tutor/repository')
  const documentSplits = new Map<string, string>()
  for (const [key, split] of courseSplits) {
    const item = cases.find(
      candidate => `${candidate.userId}:${candidate.courseId}` === key
    )!
    const documents = await getCourseDocuments(item.userId, item.courseId)
    if (!documents.length)
      throw new Error(`No authorized documents for case ${item.id}.`)
    for (const document of documents) {
      if (
        documentSplits.has(document.contentHash) &&
        documentSplits.get(document.contentHash) !== split
      ) {
        throw new Error(
          'The same PDF content appears in both validation and test splits.'
        )
      }
      documentSplits.set(document.contentHash, split)
    }
  }
  const variants = [
    { name: 'vector', mode: 'vector' as const, rerank: false },
    { name: 'hybrid-rrf', mode: 'hybrid' as const, rerank: false },
    ...(process.argv.includes('--rerank')
      ? [{ name: 'hybrid-rrf-rerank', mode: 'hybrid' as const, rerank: true }]
      : [])
  ]
  const results: {
    caseId: string
    variant: string
    split: string
    tags: string[]
    retrieval: ReturnType<typeof retrievalMetrics>
    evidence: ReturnType<typeof retrievalMetrics>
    trace: RetrievalTrace
  }[] = []
  for (const variant of variants) {
    for (const item of cases) {
      const { chunks, trace } = await retrieveEvidenceWithTrace({
        userId: item.userId,
        courseId: item.courseId,
        query: item.query,
        mode: variant.mode,
        rerank: variant.rerank
      })
      results.push({
        caseId: item.id,
        variant: variant.name,
        split: item.split,
        tags: item.tags,
        retrieval: retrievalMetrics(trace.rankedIds, item.relevantSourceIds, 6),
        evidence: retrievalMetrics(
          chunks.map(chunk => chunk.id),
          item.relevantSourceIds,
          chunks.length
        ),
        trace
      })
    }
  }
  const summaries = variants.flatMap(variant =>
    ['validation', 'test'].flatMap(split => {
      const rows = results.filter(
        item => item.variant === variant.name && item.split === split
      )
      if (!rows.length) return []
      return [
        {
          variant: variant.name,
          split,
          count: rows.length,
          recallAt6: mean(rows.map(row => row.retrieval.recall)),
          mrrAt6: mean(rows.map(row => row.retrieval.reciprocalRank)),
          evidenceRecall: mean(rows.map(row => row.evidence.recall)),
          p95Milliseconds: percentile(
            rows.map(row => row.trace.durationMs),
            0.95
          ),
          meanContextTokens: mean(rows.map(row => row.trace.contextTokens)),
          rerankFailures: rows.filter(row => row.trace.rerank === 'failed')
            .length
        }
      ]
    })
  )
  process.stdout.write(JSON.stringify({ summaries, results }, null, 2) + '\n')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(
      error instanceof Error ? error.message : 'Retrieval evaluation failed.'
    )
    process.exit(1)
  })
