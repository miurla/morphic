import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSearchProvider } from '../index'
import { OutcrawlSearchProvider } from '../outcrawl'

const hitsResponse = (hits: unknown[]) =>
  new Response(JSON.stringify({ hits, usage: { credits: '1' } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

describe('OutcrawlSearchProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('is selected by SEARCH_API=outcrawl', () => {
    vi.stubEnv('SEARCH_API', 'outcrawl')

    expect(createSearchProvider()).toBeInstanceOf(OutcrawlSearchProvider)
  })

  it('posts the query and maps hits to results', async () => {
    vi.stubEnv('OUTCRAWL_API_KEY', 'test-key')
    const fetchMock = vi.fn(async () =>
      hitsResponse([
        {
          url: 'https://nextjs.org/docs',
          title: 'Next.js Docs',
          snippet: 'Learn about Next.js',
          rank: 1
        }
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await new OutcrawlSearchProvider().search(
      'next.js app router',
      5,
      'basic',
      [],
      []
    )

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ]
    expect(url).toBe('https://api.outcrawl.ai/v1/search')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-key'
    )
    expect(JSON.parse(init.body as string)).toEqual({
      query: 'next.js app router',
      limit: 5
    })
    expect(result).toEqual({
      results: [
        {
          title: 'Next.js Docs',
          url: 'https://nextjs.org/docs',
          content: 'Learn about Next.js'
        }
      ],
      query: 'next.js app router',
      images: [],
      number_of_results: 1
    })
  })

  it('renders hits for advanced searches and applies domain filters', async () => {
    vi.stubEnv('OUTCRAWL_API_KEY', 'test-key')
    const fetchMock = vi.fn(async () =>
      hitsResponse([
        {
          url: 'https://docs.example.com/a',
          title: 'Kept',
          snippet: 'snippet',
          markdown: 'x'.repeat(1200),
          rank: 1
        },
        {
          url: 'https://blocked.example.com/b',
          title: 'Excluded',
          snippet: 'snippet',
          rank: 2
        },
        {
          url: 'https://other.org/c',
          title: 'Outside include list',
          snippet: 'snippet',
          rank: 3
        }
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await new OutcrawlSearchProvider().search(
      'query',
      10,
      'advanced',
      ['example.com'],
      ['blocked.example.com']
    )

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      query: 'query site:example.com -site:blocked.example.com',
      limit: 10,
      scrape: true,
      formats: ['markdown']
    })
    expect(result.results).toEqual([
      {
        title: 'Kept',
        url: 'https://docs.example.com/a',
        content: 'x'.repeat(1000)
      }
    ])
  })

  it('throws an HTTP error with the status for classification', async () => {
    vi.stubEnv('OUTCRAWL_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          new Response(null, { status: 401, statusText: 'Unauthorized' })
        )
      )
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const error = await new OutcrawlSearchProvider()
      .search('query', 5, 'basic', [], [])
      .catch(error => error)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('Outcrawl search failed: HTTP 401')
    expect(error.status).toBe(401)
  })

  it('requires OUTCRAWL_API_KEY', async () => {
    vi.stubEnv('OUTCRAWL_API_KEY', '')

    await expect(
      new OutcrawlSearchProvider().search('query', 5, 'basic', [], [])
    ).rejects.toThrow('OUTCRAWL_API_KEY is not set')
  })
})
