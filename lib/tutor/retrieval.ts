import { CHUNKING_VERSION, countTokens } from './chunking'
import { embedQuery, getEmbeddingIndexKey } from './embeddings'
import { buildLexicalQuery } from './lexical'
import type { RetrievedChunk } from './types'

export const RETRIEVAL_VERSION = 'tutor-hybrid-rrf-v1'
export const CANDIDATE_LIMIT = 20
export const DEFAULT_EVIDENCE_LIMIT = 6
export const DEFAULT_CONTEXT_BUDGET = 6000

export interface RetrievalOptions {
  userId: string
  courseId: string
  query: string
  anchorIds?: string[]
  limit?: number
  mode?: 'hybrid' | 'vector'
  rerank?: boolean
  contextTokenBudget?: number
}

export interface RetrievalTrace {
  version: string
  mode: 'hybrid' | 'vector'
  vectorIds: string[]
  lexicalIds: string[]
  fusedIds: string[]
  rankedIds: string[]
  evidenceIds: string[]
  rerank: 'disabled' | 'applied' | 'failed'
  contextTokens: number
  durationMs: number
}

export function assertIndexVersions(
  documents: {
    status: string
    embeddingModel: string | null
    parseVersion: string | null
  }[],
  embeddingModel = getEmbeddingIndexKey()
): void {
  if (
    !documents.length ||
    documents.some(
      document =>
        document.status !== 'ready' ||
        document.embeddingModel !== embeddingModel ||
        document.parseVersion !== CHUNKING_VERSION
    )
  ) {
    const error = new Error(
      'The document index uses a different configuration. Rebuild the course with the original index settings.'
    ) as Error & { code: string }
    error.code = 'INDEX_VERSION_MISMATCH'
    throw error
  }
}

/** Rank fusion never compares provider similarity and lexical scores directly. */
export function reciprocalRankFusion(
  lists: RetrievedChunk[][],
  constant = 60
): RetrievedChunk[] {
  const results = new Map<string, RetrievedChunk>()
  for (const list of lists) {
    const seen = new Set<string>()
    list.forEach((chunk, index) => {
      if (seen.has(chunk.id)) return
      seen.add(chunk.id)
      const current = results.get(chunk.id)
      const score = (current?.score ?? 0) + 1 / (constant + index + 1)
      results.set(chunk.id, { ...chunk, score })
    })
  }
  return [...results.values()].sort(
    (a, b) => b.score - a.score || a.id.localeCompare(b.id)
  )
}

export function chooseSeeds(
  ranked: RetrievedChunk[],
  anchors: RetrievedChunk[],
  limit: number
): RetrievedChunk[] {
  const selected = new Map<string, RetrievedChunk>()
  const parents = new Set<string>()
  for (const chunk of anchors) {
    selected.set(chunk.id, chunk)
    parents.add(`${chunk.documentId}:${chunk.parentId}`)
  }
  for (const chunk of ranked) {
    if (selected.size >= Math.max(limit, anchors.length)) break
    const parent = `${chunk.documentId}:${chunk.parentId}`
    if (selected.has(chunk.id) || parents.has(parent)) continue
    selected.set(chunk.id, chunk)
    parents.add(parent)
  }
  return [...selected.values()]
}

/** Expand with sibling evidence IDs, never silently substitute a parent's text
 * under a child ID (that would make quotes and PDF highlights incorrect). */
export function packEvidence(
  seeds: RetrievedChunk[],
  siblings: RetrievedChunk[],
  tokenBudget = DEFAULT_CONTEXT_BUDGET
): RetrievedChunk[] {
  const result: RetrievedChunk[] = []
  const selectedIds = new Set<string>()
  const parents = new Set(
    seeds.map(chunk => `${chunk.documentId}:${chunk.parentId}`)
  )
  let tokens = 0
  const add = (chunk: RetrievedChunk) => {
    if (selectedIds.has(chunk.id)) return
    const size = countTokens(chunk.retrievalText) + 32
    if (tokens + size > tokenBudget) return
    tokens += size
    selectedIds.add(chunk.id)
    result.push(chunk)
  }
  // Ranked seeds have priority over extra surrounding paragraphs.
  seeds.forEach(add)
  const selectedParents = new Set(
    result.map(chunk => `${chunk.documentId}:${chunk.parentId}`)
  )
  siblings
    .filter(chunk => {
      const parent = `${chunk.documentId}:${chunk.parentId}`
      return parents.has(parent) && selectedParents.has(parent)
    })
    .sort((a, b) => {
      const ai = seeds.findIndex(
        seed => seed.documentId === a.documentId && seed.parentId === a.parentId
      )
      const bi = seeds.findIndex(
        seed => seed.documentId === b.documentId && seed.parentId === b.parentId
      )
      return ai - bi || a.position - b.position
    })
    .forEach(add)
  return result
}

export function validateRerankResponse(
  value: unknown,
  candidates: RetrievedChunk[]
): RetrievedChunk[] {
  const response = value as {
    results?: { index: number; relevance_score: number }[]
  } | null
  if (!response || !Array.isArray(response.results) || !response.results.length)
    throw new Error('Invalid rerank response.')
  const seen = new Set<number>()
  return response.results
    .map(item => {
      if (
        !Number.isInteger(item.index) ||
        item.index < 0 ||
        item.index >= candidates.length ||
        seen.has(item.index) ||
        !Number.isFinite(item.relevance_score)
      ) {
        throw new Error('Invalid rerank response.')
      }
      seen.add(item.index)
      return { ...candidates[item.index], score: item.relevance_score }
    })
    .sort((a, b) => b.score - a.score)
}

async function rerank(
  query: string,
  candidates: RetrievedChunk[]
): Promise<RetrievedChunk[]> {
  const baseUrl = process.env.TUTOR_RERANK_BASE_URL?.replace(/\/+$/, '')
  const apiKey = process.env.TUTOR_RERANK_API_KEY
  const model = process.env.TUTOR_RERANK_MODEL
  if (!baseUrl || !apiKey || !model)
    throw new Error('Reranking is not configured.')
  const response = await fetch(`${baseUrl}/rerank`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      query,
      documents: candidates.map(chunk => chunk.retrievalText),
      top_n: candidates.length
    }),
    signal: AbortSignal.timeout(10_000)
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error('Reranking request failed.')
  }
  return validateRerankResponse(await response.json(), candidates)
}

export async function retrieveEvidenceWithTrace(
  options: RetrievalOptions
): Promise<{ chunks: RetrievedChunk[]; trace: RetrievalTrace }> {
  const started = Date.now()
  const { userId, courseId, query } = options
  const mode =
    options.mode ??
    (process.env.TUTOR_RETRIEVAL_MODE === 'vector' ? 'vector' : 'hybrid')
  const trace: RetrievalTrace = {
    version: RETRIEVAL_VERSION,
    mode,
    vectorIds: [],
    lexicalIds: [],
    fusedIds: [],
    rankedIds: [],
    evidenceIds: [],
    rerank: 'disabled',
    contextTokens: 0,
    durationMs: 0
  }
  if (!userId || !courseId)
    throw new Error('A user and course are required for retrieval.')
  if (!query.trim()) return { chunks: [], trace }
  // Lazy import keeps deterministic retrieval helpers usable in offline evals.
  const repository = await import('./repository')
  assertIndexVersions(await repository.getCourseDocuments(userId, courseId))
  const embedding = await embedQuery(query)
  const lexicalQuery = buildLexicalQuery(query)
  const [vector, lexical, anchors] = await Promise.all([
    repository.searchVectorChunks(userId, courseId, embedding, CANDIDATE_LIMIT),
    mode === 'hybrid' && lexicalQuery
      ? repository.searchLexicalChunks(
          userId,
          courseId,
          lexicalQuery,
          CANDIDATE_LIMIT
        )
      : Promise.resolve([]),
    options.anchorIds?.length
      ? repository.getChunksByIds(
          userId,
          courseId,
          [...new Set(options.anchorIds)].slice(0, 32)
        )
      : Promise.resolve([])
  ])
  trace.vectorIds = vector.map(chunk => chunk.id)
  trace.lexicalIds = lexical.map(chunk => chunk.id)
  let ranked =
    mode === 'hybrid' ? reciprocalRankFusion([vector, lexical]) : vector
  trace.fusedIds = ranked.map(chunk => chunk.id)
  const useRerank =
    options.rerank ?? process.env.TUTOR_RERANK_ENABLED === 'true'
  if (useRerank && ranked.length) {
    try {
      ranked = await rerank(query, ranked)
      trace.rerank = 'applied'
    } catch {
      // Explicitly observable fallback; document data and provider errors stay private.
      trace.rerank = 'failed'
      console.warn('[Tutor] Reranking failed; using fused retrieval results.')
    }
  }
  trace.rankedIds = ranked.map(chunk => chunk.id)
  const limit = Math.max(
    1,
    Math.min(16, options.limit ?? DEFAULT_EVIDENCE_LIMIT)
  )
  const seeds = chooseSeeds(ranked, anchors, limit)
  const siblings = seeds.length
    ? await repository.getChunksByParentIds(userId, courseId, [
        ...new Set(seeds.map(chunk => chunk.parentId))
      ])
    : []
  const budget = Math.max(
    600,
    Math.min(12_000, options.contextTokenBudget ?? DEFAULT_CONTEXT_BUDGET)
  )
  const chunks = packEvidence(seeds, siblings, budget)
  trace.evidenceIds = chunks.map(chunk => chunk.id)
  trace.contextTokens = chunks.reduce(
    (sum, chunk) => sum + countTokens(chunk.retrievalText) + 32,
    0
  )
  trace.durationMs = Date.now() - started
  return { chunks, trace }
}

export async function retrieveEvidence(
  options: RetrievalOptions
): Promise<RetrievedChunk[]> {
  return (await retrieveEvidenceWithTrace(options)).chunks
}
