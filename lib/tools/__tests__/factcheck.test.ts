import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createFactCheckTool } from '../factcheck'

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }

function mockFetchResponse(status: number, body: any) {
  globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'content-type': 'application/json'
      }
    })
  }) as typeof fetch
}

describe('googleFactCheckTool', () => {
  beforeEach(() => {
    // Clear all Google API keys from environment to isolate tests
    delete process.env.GOOGLE_FACT_CHECK_API_KEY
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete process.env.GOOGLE_MAPS_API_KEY
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env = { ...originalEnv }
  })

  test('throws error if no API key is available', async () => {
    const tool = createFactCheckTool()
    const executePromise = (async () => {
      const result = tool.execute!({ query: 'test claim' }, { toolCallId: 'test', messages: [] })
      for await (const _ of result as AsyncIterable<any>) {
        // consume the generator
      }
    })()

    await expect(executePromise).rejects.toThrow(
      'Google Fact Check API Key is not configured.'
    )
  })

  test('calls API using GOOGLE_FACT_CHECK_API_KEY', async () => {
    process.env.GOOGLE_FACT_CHECK_API_KEY = 'key_factcheck'
    mockFetchResponse(200, {
      claims: [
        {
          text: 'The Earth is flat.',
          claimant: 'Flat Earth Society',
          claimDate: '2026-01-01',
          claimReview: [
            {
              publisher: { name: 'Science Check', site: 'sciencecheck.org' },
              url: 'https://sciencecheck.org/flat-earth',
              title: 'Is Earth Flat?',
              reviewDate: '2026-02-01',
              textualRating: 'False',
              languageCode: 'en'
            }
          ]
        }
      ]
    })

    const tool = createFactCheckTool()
    const generator = tool.execute!({ query: 'flat earth', languageCode: 'en' }, { toolCallId: 'test-call', messages: [] })
    
    const chunks = []
    for await (const chunk of generator as AsyncIterable<any>) {
      chunks.push(chunk)
    }

    // Checking the intermediate state (searching) and final state (complete)
    expect(chunks[0]).toEqual({ state: 'searching', query: 'flat earth' })
    
    const finalResult = chunks[1] as any
    expect(finalResult.state).toBe('complete')
    expect(finalResult.query).toBe('flat earth')
    expect(finalResult.toolCallId).toBe('test-call')
    expect(finalResult.claims).toHaveLength(1)
    expect(finalResult.claims[0].text).toBe('The Earth is flat.')
    expect(finalResult.claims[0].claimant).toBe('Flat Earth Society')
    expect(finalResult.claims[0].claimReview[0].textualRating).toBe('False')
    expect(finalResult.claims[0].claimReview[0].publisher.name).toBe('Science Check')

    // Verify correct URL and key were passed
    expect(globalThis.fetch).toHaveBeenCalled()
    const fetchUrl = (globalThis.fetch as any).mock.calls[0][0]
    expect(fetchUrl).toContain('key=key_factcheck')
    expect(fetchUrl).toContain('query=flat+earth')
    expect(fetchUrl).toContain('languageCode=en')
  })

  test('falls back to GOOGLE_GENERATIVE_AI_API_KEY', async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'key_gemini'
    mockFetchResponse(200, { claims: [] })

    const tool = createFactCheckTool()
    const generator = tool.execute!({ query: 'test' }, { toolCallId: 'test', messages: [] })
    for await (const _ of generator as AsyncIterable<any>) {}

    const fetchUrl = (globalThis.fetch as any).mock.calls[0][0]
    expect(fetchUrl).toContain('key=key_gemini')
  })

  test('falls back to GOOGLE_MAPS_API_KEY', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'key_maps'
    mockFetchResponse(200, { claims: [] })

    const tool = createFactCheckTool()
    const generator = tool.execute!({ query: 'test' }, { toolCallId: 'test', messages: [] })
    for await (const _ of generator as AsyncIterable<any>) {}

    const fetchUrl = (globalThis.fetch as any).mock.calls[0][0]
    expect(fetchUrl).toContain('key=key_maps')
  })

  test('falls back to NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'key_public_maps'
    mockFetchResponse(200, { claims: [] })

    const tool = createFactCheckTool()
    const generator = tool.execute!({ query: 'test' }, { toolCallId: 'test', messages: [] })
    for await (const _ of generator as AsyncIterable<any>) {}

    const fetchUrl = (globalThis.fetch as any).mock.calls[0][0]
    expect(fetchUrl).toContain('key=key_public_maps')
  })

  test('throws error if API returns non-OK status', async () => {
    process.env.GOOGLE_FACT_CHECK_API_KEY = 'test_key'
    mockFetchResponse(403, { error: { message: 'Invalid API key' } })

    const tool = createFactCheckTool()
    const executePromise = (async () => {
      const result = tool.execute!({ query: 'test' }, { toolCallId: 'test', messages: [] })
      for await (const _ of result as AsyncIterable<any>) {}
    })()

    await expect(executePromise).rejects.toThrow(
      'Google Fact Check API error: 403'
    )
  })
})
