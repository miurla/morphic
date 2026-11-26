import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CHUNKING_VERSION } from '../chunking'
import { retrieveEvidenceWithTrace } from '../retrieval'
import type { RetrievedChunk } from '../types'

const mocks = vi.hoisted(() => ({
  embedQuery: vi.fn(),
  getCourseDocuments: vi.fn(),
  searchVectorChunks: vi.fn(),
  searchLexicalChunks: vi.fn(),
  getChunksByIds: vi.fn(),
  getChunksByParentIds: vi.fn()
}))
vi.mock('../repository', () => mocks)
vi.mock('../embeddings', () => ({
  embedQuery: mocks.embedQuery,
  getEmbeddingIndexKey: () => 'test-embedding'
}))

const evidence: RetrievedChunk = {
  id: 'source-a',
  documentId: 'document-a',
  parentId: 'parent-a',
  filename: 'a.pdf',
  text: 'Atomicity is all or nothing.',
  parentText: 'Atomicity is all or nothing.',
  retrievalText: 'Transactions: Atomicity is all or nothing.',
  lexicalText: 'atomicity',
  heading: 'Transactions',
  position: 0,
  tokenCount: 8,
  score: 0.9,
  regions: [{ page: 1, x: 0, y: 0, width: 1, height: 0.1 }]
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.embedQuery.mockResolvedValue([1, 0])
  mocks.getCourseDocuments.mockResolvedValue([
    {
      status: 'ready',
      embeddingModel: 'test-embedding',
      parseVersion: CHUNKING_VERSION
    }
  ])
  mocks.searchVectorChunks.mockResolvedValue([evidence])
  mocks.searchLexicalChunks.mockResolvedValue([evidence])
  mocks.getChunksByIds.mockResolvedValue([evidence])
  mocks.getChunksByParentIds.mockResolvedValue([evidence])
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Tutor retrieval scope and index versions', () => {
  it.each(['embedding', 'search'])(
    'stops before reranking when deletion occurs during %s',
    async phase => {
      let deleted = false
      const cancelled = new Error('Course deleted')
      const ensureActive = async () => {
        if (deleted) throw cancelled
      }
      if (phase === 'embedding') {
        mocks.embedQuery.mockImplementationOnce(async () => {
          deleted = true
          return [1, 0]
        })
      } else {
        mocks.searchVectorChunks.mockImplementationOnce(async () => {
          deleted = true
          return [evidence]
        })
      }
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      await expect(
        retrieveEvidenceWithTrace({
          userId: 'alice',
          courseId: 'course-a',
          query: 'atomicity',
          rerank: true,
          ensureActive
        })
      ).rejects.toBe(cancelled)
      expect(mocks.embedQuery).toHaveBeenCalledWith('atomicity', ensureActive)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(mocks.getChunksByParentIds).not.toHaveBeenCalled()
    }
  )

  it('passes the authenticated scope into every lookup including parent expansion', async () => {
    const result = await retrieveEvidenceWithTrace({
      userId: 'alice',
      courseId: 'course-a',
      query: '原子性 atomicity',
      anchorIds: ['source-a'],
      rerank: false
    })
    expect(mocks.getCourseDocuments).toHaveBeenCalledWith('alice', 'course-a')
    expect(mocks.searchVectorChunks).toHaveBeenCalledWith(
      'alice',
      'course-a',
      [1, 0],
      20
    )
    expect(mocks.searchLexicalChunks).toHaveBeenCalledWith(
      'alice',
      'course-a',
      expect.stringContaining('atomicity'),
      20
    )
    expect(mocks.getChunksByIds).toHaveBeenCalledWith('alice', 'course-a', [
      'source-a'
    ])
    expect(mocks.getChunksByParentIds).toHaveBeenCalledWith(
      'alice',
      'course-a',
      ['parent-a']
    )
    expect(result.chunks).toHaveLength(1)
    expect(result.trace).toMatchObject({
      mode: 'hybrid',
      evidenceIds: ['source-a'],
      rerank: 'disabled'
    })
  })

  it('rejects indexes built by a different embedding or parser before a paid request', async () => {
    for (const overrides of [
      { embeddingModel: 'different' },
      { parseVersion: 'old-parser' },
      { status: 'uploaded' }
    ]) {
      mocks.getCourseDocuments.mockResolvedValue([
        {
          status: 'ready',
          embeddingModel: 'test-embedding',
          parseVersion: CHUNKING_VERSION,
          ...overrides
        }
      ])
      await expect(
        retrieveEvidenceWithTrace({
          userId: 'alice',
          courseId: 'course-a',
          query: 'atomicity'
        })
      ).rejects.toMatchObject({ code: 'INDEX_VERSION_MISMATCH' })
    }
    expect(mocks.embedQuery).not.toHaveBeenCalled()
    expect(mocks.searchVectorChunks).not.toHaveBeenCalled()
  })

  it('keeps a vector-only baseline and does no work on an empty query', async () => {
    await retrieveEvidenceWithTrace({
      userId: 'alice',
      courseId: 'course-a',
      query: 'atomicity',
      mode: 'vector',
      rerank: false
    })
    expect(mocks.searchLexicalChunks).not.toHaveBeenCalled()
    vi.clearAllMocks()
    const result = await retrieveEvidenceWithTrace({
      userId: 'alice',
      courseId: 'course-a',
      query: ' '
    })
    expect(result.chunks).toEqual([])
    expect(mocks.embedQuery).not.toHaveBeenCalled()
  })

  it('reranks the fused candidates with the local service when enabled', async () => {
    const otherEvidence = {
      ...evidence,
      id: 'source-b',
      retrievalText:
        'Atomicity means an entire transaction succeeds or rolls back.'
    }
    mocks.searchVectorChunks.mockResolvedValue([evidence, otherEvidence])
    vi.stubEnv('TUTOR_RERANK_ENABLED', 'true')
    vi.stubEnv('TUTOR_RERANK_AUTH', 'none')
    vi.stubEnv('TUTOR_RERANK_BASE_URL', 'http://tutor-reranker:8080/v1')
    vi.stubEnv('TUTOR_RERANK_MODEL', 'BAAI/bge-reranker-v2-m3')
    vi.stubEnv('TUTOR_RERANK_API_KEY', 'should-not-be-forwarded')
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        results: [
          { index: 0, relevance_score: -1 },
          { index: 1, relevance_score: 3 }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const { trace } = await retrieveEvidenceWithTrace({
      userId: 'alice',
      courseId: 'course-a',
      query: 'atomicity'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://tutor-reranker:8080/v1/rerank',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'BAAI/bge-reranker-v2-m3',
          query: 'atomicity',
          documents: [evidence.retrievalText, otherEvidence.retrievalText],
          top_n: 2
        })
      })
    )
    expect(trace).toMatchObject({
      fusedIds: ['source-a', 'source-b'],
      rankedIds: ['source-b', 'source-a'],
      rerank: 'applied'
    })
  })
})
