import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  embedTexts,
  getEmbeddingConfig,
  getEmbeddingIndexKey,
  validateEmbeddingResponse
} from '../embeddings'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Tutor embeddings', () => {
  it('versions vector spaces by provider and revision, but not by API key rotation', () => {
    vi.stubEnv('TUTOR_EMBEDDING_BASE_URL', 'https://first.example.test/v1')
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'first-key')
    vi.stubEnv('TUTOR_EMBEDDING_REVISION', '1')
    const initial = getEmbeddingIndexKey()
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'rotated-key')
    expect(getEmbeddingIndexKey()).toBe(initial)
    vi.stubEnv('TUTOR_EMBEDDING_BASE_URL', 'https://second.example.test/v1')
    expect(getEmbeddingIndexKey()).not.toBe(initial)
    vi.stubEnv('TUTOR_EMBEDDING_BASE_URL', 'https://first.example.test/v1')
    vi.stubEnv('TUTOR_EMBEDDING_REVISION', '2')
    expect(getEmbeddingIndexKey()).not.toBe(initial)
  })
  it('reorders provider vectors by index and rejects wrong-sized or non-finite data', () => {
    expect(
      validateEmbeddingResponse(
        {
          data: [
            { index: 1, embedding: [0, 1] },
            { index: 0, embedding: [1, 0] }
          ]
        },
        2,
        2
      )
    ).toEqual([
      [1, 0],
      [0, 1]
    ])
    for (const embedding of [[1], [1, NaN], [0, 0]]) {
      expect(() =>
        validateEmbeddingResponse({ data: [{ index: 0, embedding }] }, 1, 2)
      ).toThrow()
    }
    expect(() =>
      validateEmbeddingResponse(
        {
          data: [
            { index: 0, embedding: [1, 0] },
            { index: 0, embedding: [0, 1] }
          ]
        },
        2,
        2
      )
    ).toThrow()
  })

  it('does not create fake embeddings when configuration is missing', async () => {
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(embedTexts(['Some evidence'])).rejects.toMatchObject({
      code: 'EMBEDDING_NOT_CONFIGURED'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses dedicated credentials and batches requests without losing input order', async () => {
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'unit-test-key')
    vi.stubEnv(
      'TUTOR_EMBEDDING_BASE_URL',
      'https://embeddings.example.test/v1/'
    )
    vi.stubEnv('TUTOR_EMBEDDING_MODEL', 'test-model')
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body)
      return new Response(
        JSON.stringify({
          data: body.input
            .map((input: string, index: number) => ({
              index,
              embedding: Array.from({ length: 1536 }, (_, dimension) =>
                dimension === 0 ? Number(input) + 1 : 0
              )
            }))
            .reverse()
        }),
        { status: 200 }
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const values = await embedTexts(
      Array.from({ length: 35 }, (_, index) => String(index))
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(values.map(vector => vector[0])).toEqual(
      Array.from({ length: 35 }, (_, index) => index + 1)
    )
    expect(getEmbeddingConfig()).toMatchObject({
      baseUrl: 'https://embeddings.example.test/v1',
      model: 'test-model',
      dimensions: 1536
    })
  })

  it('does not retry a credential rejection or leak its response body', async () => {
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'unit-test-key')
    const fetchMock = vi.fn(
      async () => new Response('private provider error', { status: 401 })
    )
    vi.stubGlobal('fetch', fetchMock)
    await expect(embedTexts(['Some evidence'])).rejects.toMatchObject({
      code: 'EMBEDDING_REQUEST_FAILED'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
