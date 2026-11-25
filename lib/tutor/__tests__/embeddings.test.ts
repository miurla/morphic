import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  embedTexts,
  getEmbeddingConfig,
  getEmbeddingIndexKey,
  validateEmbeddingResponse
} from '../embeddings'

beforeEach(() => {
  vi.stubEnv('TUTOR_EMBEDDING_AUTH', '')
  vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', '')
  vi.stubEnv('TUTOR_EMBEDDING_SEND_DIMENSIONS', '')
  vi.stubEnv('TUTOR_EMBEDDING_BATCH_SIZE', '')
  vi.stubEnv('TUTOR_EMBEDDING_TIMEOUT_MS', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Tutor embeddings', () => {
  it.each(['next-batch', 'http-retry', 'network-retry'])(
    'stops %s when a course is deleted without treating cancellation as a provider error',
    async phase => {
      vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'unit-test-key')
      vi.stubEnv('TUTOR_EMBEDDING_BATCH_SIZE', '1')
      vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', '2')
      let deleted = false
      const cancelled = new Error('Course deleted')
      const fetchMock = vi.fn(async () => {
        deleted = true
        if (phase === 'network-retry') throw new Error('Network failed')
        if (phase === 'http-retry') return new Response(null, { status: 503 })
        return Response.json({ data: [{ index: 0, embedding: [1, 0] }] })
      })
      vi.stubGlobal('fetch', fetchMock)
      await expect(
        embedTexts(['First', 'Second'], async () => {
          if (deleted) throw cancelled
        })
      ).rejects.toBe(cancelled)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  )

  it.each(['', 'stale-cloud-key'])(
    'supports keyless local requests without forwarding credentials (%s)',
    async dedicatedKey => {
      vi.stubEnv('TUTOR_EMBEDDING_AUTH', 'none')
      vi.stubEnv('TUTOR_EMBEDDING_BASE_URL', 'http://tutor-embedding:11434/v1')
      vi.stubEnv('TUTOR_EMBEDDING_MODEL', 'bge-m3')
      vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', '1024')
      vi.stubEnv('TUTOR_EMBEDDING_SEND_DIMENSIONS', 'false')
      vi.stubEnv('TUTOR_EMBEDDING_API_KEY', dedicatedKey)
      vi.stubEnv('OPENAI_API_KEY', 'unrelated-teaching-key')
      const embedding = [1, ...Array(1023).fill(0)]
      const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
        Response.json({ data: [{ index: 0, embedding }] })
      )
      vi.stubGlobal('fetch', fetchMock)
      expect(getEmbeddingConfig()).toMatchObject({ auth: 'none', apiKey: '' })
      expect(await embedTexts(['本地资料'])).toEqual([embedding])
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('http://tutor-embedding:11434/v1/embeddings')
      expect(new Headers(init.headers).has('authorization')).toBe(false)
      expect(new Headers(init.headers).get('content-type')).toBe(
        'application/json'
      )
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'bge-m3',
        input: ['本地资料'],
        encoding_format: 'float'
      })
    }
  )

  it('requires an explicit endpoint for keyless authentication', () => {
    vi.stubEnv('TUTOR_EMBEDDING_AUTH', 'none')
    vi.stubEnv('TUTOR_EMBEDDING_BASE_URL', '')
    vi.stubEnv('OPENAI_BASE_URL', 'https://cloud.example.test/v1')
    expect(() => getEmbeddingConfig()).toThrow(
      'TUTOR_EMBEDDING_BASE_URL must be set when embedding authentication is disabled.'
    )
  })

  it('rejects invalid authentication modes', () => {
    vi.stubEnv('TUTOR_EMBEDDING_AUTH', 'disabled')
    expect(() => getEmbeddingConfig()).toThrow(
      'TUTOR_EMBEDDING_AUTH must be bearer or none.'
    )
  })

  it('keeps the document index identity when removing placeholder authentication', () => {
    vi.stubEnv('TUTOR_EMBEDDING_BASE_URL', 'http://tutor-embedding:11434/v1')
    vi.stubEnv('TUTOR_EMBEDDING_MODEL', 'bge-m3')
    vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', '1024')
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'ollama')
    const initial = getEmbeddingIndexKey()
    vi.stubEnv('TUTOR_EMBEDDING_AUTH', 'none')
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', '')
    expect(getEmbeddingIndexKey()).toBe(initial)
  })

  it('preserves bearer authentication and OpenAI key fallback by default', async () => {
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', 'fallback-test-key')
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({
        data: [{ index: 0, embedding: [1, ...Array(1535).fill(0)] }]
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    expect(getEmbeddingConfig()).toMatchObject({
      auth: 'bearer',
      apiKey: 'fallback-test-key'
    })
    await embedTexts(['Some evidence'])
    expect(
      new Headers(fetchMock.mock.calls[0][1].headers).get('authorization')
    ).toBe('Bearer fallback-test-key')
  })

  it('preserves the existing default vector space identity', () => {
    vi.stubEnv('TUTOR_EMBEDDING_BASE_URL', 'https://embeddings.example.test/v1')
    vi.stubEnv('TUTOR_EMBEDDING_MODEL', 'test-model')
    vi.stubEnv('TUTOR_EMBEDDING_REVISION', '1')
    const legacyIdentity = JSON.stringify({
      baseUrl: 'https://embeddings.example.test/v1',
      model: 'test-model',
      dimensions: 1536,
      revision: '1'
    })
    const legacyKey = `test-model@${createHash('sha256').update(legacyIdentity).digest('hex').slice(0, 20)}`
    expect(getEmbeddingIndexKey()).toBe(legacyKey)
    expect(getEmbeddingConfig()).toMatchObject({
      dimensions: 1536,
      sendDimensions: true,
      batchSize: 32,
      timeoutMs: 45_000
    })
    vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', '1024')
    expect(getEmbeddingIndexKey()).not.toBe(legacyKey)
  })

  it.each(['0', '-1', '1.5', 'NaN', 'Infinity', '1e3', '9007199254740993'])(
    'rejects invalid dimensions %s before making a provider request',
    async dimensions => {
      vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'unit-test-key')
      vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', dimensions)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      await expect(embedTexts(['Some evidence'])).rejects.toMatchObject({
        code: 'EMBEDDING_INVALID_CONFIG'
      })
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('rejects an invalid dimensions-request flag', () => {
    vi.stubEnv('TUTOR_EMBEDDING_SEND_DIMENSIONS', 'no')
    expect(() => getEmbeddingConfig()).toThrow(
      'TUTOR_EMBEDDING_SEND_DIMENSIONS must be true or false.'
    )
  })

  it.each([
    ['TUTOR_EMBEDDING_BATCH_SIZE', '0'],
    ['TUTOR_EMBEDDING_BATCH_SIZE', '-1'],
    ['TUTOR_EMBEDDING_BATCH_SIZE', '1.5'],
    ['TUTOR_EMBEDDING_BATCH_SIZE', '129'],
    ['TUTOR_EMBEDDING_BATCH_SIZE', '1e2'],
    ['TUTOR_EMBEDDING_TIMEOUT_MS', '0'],
    ['TUTOR_EMBEDDING_TIMEOUT_MS', '-1'],
    ['TUTOR_EMBEDDING_TIMEOUT_MS', '1.5'],
    ['TUTOR_EMBEDDING_TIMEOUT_MS', 'Infinity'],
    ['TUTOR_EMBEDDING_TIMEOUT_MS', 'NaN'],
    ['TUTOR_EMBEDDING_TIMEOUT_MS', '2147483648'],
    ['TUTOR_EMBEDDING_TIMEOUT_MS', '9007199254740993']
  ])(
    'rejects invalid %s=%s before requesting embeddings',
    async (name, value) => {
      vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'unit-test-key')
      vi.stubEnv(name, value)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      await expect(embedTexts(['Some evidence'])).rejects.toMatchObject({
        code: 'EMBEDDING_INVALID_CONFIG'
      })
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('uses smaller batches and a longer timeout without changing the index', async () => {
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'unit-test-key')
    vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', '2')
    const initialIndex = getEmbeddingIndexKey()
    vi.stubEnv('TUTOR_EMBEDDING_BATCH_SIZE', '2')
    vi.stubEnv('TUTOR_EMBEDDING_TIMEOUT_MS', '180000')
    expect(getEmbeddingIndexKey()).toBe(initialIndex)
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      return Response.json({
        data: body.input
          .map((input: string, index: number) => ({
            index,
            embedding: [Number(input), 0]
          }))
          .reverse()
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await embedTexts(['1', '2', '3', '4', '5'])).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0]
    ])
    expect(
      fetchMock.mock.calls.map(
        ([, init]) => JSON.parse(init.body as string).input
      )
    ).toEqual([['1', '2'], ['3', '4'], ['5']])
    expect(timeoutSpy.mock.calls).toEqual([[180_000], [180_000], [180_000]])
    for (let i = 0; i < fetchMock.mock.calls.length; i++) {
      expect(fetchMock.mock.calls[i][1].signal).toBe(
        timeoutSpy.mock.results[i].value
      )
    }
  })

  it('supports native 1024-dimensional embeddings without sending dimensions', async () => {
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'unit-test-key')
    vi.stubEnv('TUTOR_EMBEDDING_BASE_URL', 'https://embeddings.example.test/v1')
    vi.stubEnv('TUTOR_EMBEDDING_MODEL', 'BAAI/bge-m3')
    vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', '1024')
    vi.stubEnv('TUTOR_EMBEDDING_SEND_DIMENSIONS', 'false')
    const embedding = [1, ...Array(1023).fill(0)]
    const fetchMock = vi.fn(async () =>
      Response.json({ data: [{ index: 0, embedding }] })
    )
    vi.stubGlobal('fetch', fetchMock)
    expect(await embedTexts(['中文资料'])).toEqual([embedding])
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ]
    expect(url).toBe('https://embeddings.example.test/v1/embeddings')
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'BAAI/bge-m3',
      input: ['中文资料'],
      encoding_format: 'float'
    })
    const nativeKey = getEmbeddingIndexKey()
    vi.stubEnv('TUTOR_EMBEDDING_SEND_DIMENSIONS', 'true')
    expect(getEmbeddingIndexKey()).toBe(nativeKey)
    await embedTexts(['中文资料'])
    const secondInit = (
      fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    )[1]
    expect(JSON.parse(secondInit.body as string).dimensions).toBe(1024)
  })

  it('rejects a 1536-dimensional response when configured for 1024', async () => {
    vi.stubEnv('TUTOR_EMBEDDING_API_KEY', 'unit-test-key')
    vi.stubEnv('TUTOR_EMBEDDING_DIMENSIONS', '1024')
    vi.stubEnv('TUTOR_EMBEDDING_SEND_DIMENSIONS', 'false')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          data: [{ index: 0, embedding: [1, ...Array(1535).fill(0)] }]
        })
      )
    )
    await expect(embedTexts(['Some evidence'])).rejects.toMatchObject({
      code: 'EMBEDDING_INVALID_RESPONSE'
    })
  })

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
