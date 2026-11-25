import { describe, expect, it } from 'vitest'

import { chunkDocument, countTokens, splitLongText } from '../chunking'
import { assertCitationIds, toSourceCitation } from '../citations'
import { buildLexicalQuery, lexicalTerms } from '../lexical'
import {
  chooseSeeds,
  packEvidence,
  reciprocalRankFusion,
  validateRerankResponse
} from '../retrieval'
import type { ParsedPdf, RetrievedChunk } from '../types'

function chunk(
  id: string,
  parentId = id,
  documentId = 'document-a'
): RetrievedChunk {
  return {
    id,
    parentId,
    documentId,
    filename: 'course.pdf',
    position: 0,
    text: `Original evidence ${id}.`,
    parentText: 'A larger paragraph with additional context.',
    retrievalText: `course.pdf / Original evidence ${id}.`,
    lexicalText: id,
    heading: 'Introduction',
    regions: [{ page: 1, x: 0.1, y: 0.2, width: 0.6, height: 0.05 }],
    tokenCount: 6,
    score: 0.5
  }
}

describe('Tutor lexical retrieval', () => {
  it('uses CJK word boundaries and preserves case-normalized identifiers', () => {
    const terms = lexicalTerms(
      '学习数据库事务，介绍 PostgreSQL、C++ 和 get_user_id。'
    )
    expect(terms).toContain('学习')
    expect(terms).toContain('数据库')
    expect(terms).toContain('postgresql')
    expect(terms).toContain('c++')
    expect(terms).toContain('get_user_id')
    expect(buildLexicalQuery(' ，。！？ ')).toBe('')
  })
})

describe('Tutor source-aware chunks', () => {
  it('covers every source block while bounding child and parent context sizes', () => {
    const blocks = Array.from({ length: 80 }, (_, index) => ({
      text: `Evidence-${index}: ${'A complete explanation of a database concept. '.repeat(18)}`,
      region: {
        page: Math.floor(index / 8) + 1,
        x: 0.1,
        y: (index % 8) / 10 + 0.1,
        width: 0.7,
        height: 0.08
      }
    }))
    const chunks = chunkDocument({
      documentId: 'long',
      filename: 'long.pdf',
      parsed: { pageCount: 10, blocks, warnings: [] }
    })
    const text = chunks.map(item => item.text).join('\n')
    expect(chunks.length).toBeGreaterThan(4)
    for (let index = 0; index < 80; index++)
      expect(text).toContain(`Evidence-${index}:`)
    for (const item of chunks) {
      expect(countTokens(item.text)).toBeLessThanOrEqual(600)
      expect(countTokens(item.parentText)).toBeLessThanOrEqual(1800)
      expect(item.regions.length).toBeGreaterThan(0)
    }
  })
  it('keeps CJK scalar values intact when enforcing token limits', () => {
    const parts = splitLongText(
      '数据库事务的一致性很重要。🙂'.repeat(100),
      80,
      10
    )
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) {
      expect(part).not.toContain('\uFFFD')
      expect(countTokens(part)).toBeLessThanOrEqual(80)
    }
  })

  it('keeps stable IDs within a document and separates duplicate documents', () => {
    const parsed: ParsedPdf = {
      pageCount: 2,
      warnings: [],
      blocks: [
        {
          text: 'Transactions',
          heading: true,
          region: { page: 1, x: 0.1, y: 0.1, width: 0.5, height: 0.05 }
        },
        {
          text: 'Atomicity means changes succeed or fail together.',
          region: { page: 1, x: 0.1, y: 0.2, width: 0.7, height: 0.05 }
        },
        {
          text: 'Consistency preserves valid database states.',
          region: { page: 2, x: 0.1, y: 0.2, width: 0.7, height: 0.05 }
        }
      ]
    }
    const input = { documentId: 'a', filename: 'db.pdf', parsed }
    const first = chunkDocument(input)
    expect(chunkDocument(input)).toEqual(first)
    expect(chunkDocument({ ...input, documentId: 'b' })[0].id).not.toBe(
      first[0].id
    )
    expect(first[0].regions.map(region => region.page)).toEqual([1, 1, 2])
    expect(first[0].text).toContain('Atomicity')
    expect(first[0].retrievalText).toContain('Transactions')
    expect(first[0].text).not.toContain('db.pdf')
  })
})

describe('Tutor fusion and evidence packing', () => {
  it('fuses ranks, ignores incomparable raw scores, and counts duplicate results once', () => {
    const a = { ...chunk('a'), score: 99_000 }
    const b = { ...chunk('b'), score: -200 }
    const results = reciprocalRankFusion([[a, a, b], [b]])
    expect(results.map(result => result.id)).toEqual(['b', 'a'])
    expect(results[1].score).toBeCloseTo(1 / 61)
  })

  it('diversifies parents but does not collapse unrelated documents', () => {
    const a = chunk('a', 'shared')
    const b = chunk('b', 'shared')
    const c = chunk('c', 'shared', 'document-b')
    expect(chooseSeeds([a, b, c], [], 2).map(result => result.id)).toEqual([
      'a',
      'c'
    ])
    expect(chooseSeeds([c], [a, b], 1).map(result => result.id)).toEqual([
      'a',
      'b'
    ])
  })

  it('expands siblings with their own evidence IDs and honors the context budget', () => {
    const seed = chunk('seed', 'parent')
    const sibling = chunk('sibling', 'parent')
    const foreign = chunk('foreign', 'other')
    const result = packEvidence([seed], [sibling, foreign], 500)
    expect(result.map(item => item.id)).toEqual(['seed', 'sibling'])
    expect(result[0].text).toBe(seed.text)
    expect(result[0].text).not.toBe(seed.parentText)
    const seedBudget = countTokens(seed.retrievalText) + 32
    expect(packEvidence([seed], [sibling], seedBudget)).toEqual([seed])
  })

  it('rejects duplicated or fabricated reranker indexes', () => {
    expect(() =>
      validateRerankResponse({ results: [{ index: 5, relevance_score: 1 }] }, [
        chunk('a')
      ])
    ).toThrow()
    expect(() =>
      validateRerankResponse(
        {
          results: [
            { index: 0, relevance_score: 1 },
            { index: 0, relevance_score: 0.9 }
          ]
        },
        [chunk('a')]
      )
    ).toThrow()
  })
})

describe('Tutor citations', () => {
  it('rejects empty and invented sources and builds quotes only from extracted text', () => {
    expect(() => assertCitationIds([], [chunk('a')])).toThrow()
    expect(() =>
      assertCitationIds(['other-user-source'], [chunk('a')])
    ).toThrow()
    expect(() => assertCitationIds(['a'], [chunk('a')])).not.toThrow()
    expect(toSourceCitation(chunk('a')).quote).toBe('Original evidence a.')
  })
})
