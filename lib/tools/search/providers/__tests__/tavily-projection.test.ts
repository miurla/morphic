import { afterEach, describe, expect, it, vi } from 'vitest'

import { TavilySearchProvider } from '../tavily'

describe('TavilySearchProvider result projection', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const searchWithPayload = async (payload: unknown) => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(payload))
    )

    return new TavilySearchProvider().search('a test query', 5, 'basic')
  }

  it('keeps only the declared result fields', async () => {
    const result = await searchWithPayload({
      query: 'a test query',
      response_time: 1.2,
      request_id: 'req_1',
      results: [
        {
          title: 'A',
          url: 'https://a.test',
          content: 'alpha',
          score: 0.93,
          raw_content: null,
          id: 'res_1',
          images: [
            { url: 'https://a.test/1.png', description: null, score: 10 }
          ]
        }
      ],
      images: []
    })

    expect(result.results).toEqual([
      { title: 'A', url: 'https://a.test', content: 'alpha' }
    ])
    expect(result.number_of_results).toBe(1)
    expect(result).not.toHaveProperty('response_time')
    expect(result).not.toHaveProperty('request_id')
  })

  it('still returns top-level images for the UI and the image prompt', async () => {
    const result = await searchWithPayload({
      query: 'a test query',
      results: [{ title: 'A', url: 'https://a.test', content: 'alpha' }],
      images: [
        { url: 'https://a.test/1.png', title: 'A', description: 'one' },
        { url: 'https://a.test/2.png', description: '' }
      ]
    })

    expect(result.images).toEqual([
      {
        url: 'https://a.test/1.png',
        description: 'one',
        title: 'A',
        sourceUrl: 'https://a.test'
      }
    ])
  })
})
