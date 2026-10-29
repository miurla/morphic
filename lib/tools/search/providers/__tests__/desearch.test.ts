import { afterEach, describe, expect, it, vi } from 'vitest'

import { DesearchSearchProvider } from '../desearch'

vi.mock('../brave', () => ({ BraveSearchProvider: class {} }))
vi.mock('../exa', () => ({ ExaSearchProvider: class {} }))
vi.mock('../firecrawl', () => ({ FirecrawlSearchProvider: class {} }))
vi.mock('../searxng', () => ({ SearXNGSearchProvider: class {} }))
vi.mock('../tavily', () => ({ TavilySearchProvider: class {} }))

import { createSearchProvider } from '../index'

describe('DesearchSearchProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('selects the provider from SEARCH_API or an explicit argument', () => {
    vi.stubEnv('SEARCH_API', 'desearch')
    expect(createSearchProvider()).toBeInstanceOf(DesearchSearchProvider)
    expect(createSearchProvider('desearch')).toBeInstanceOf(
      DesearchSearchProvider
    )
  })

  it('encodes the query, authenticates and maps web results', async () => {
    vi.stubEnv('DESEARCH_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          { title: 'Example', link: 'https://example.org', snippet: 'Text' }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const query = 'a & b + ქართული'
    const result = await new DesearchSearchProvider().search(
      query,
      3,
      'advanced',
      ['include.org'],
      ['exclude.org']
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url.origin + url.pathname).toBe('https://api.desearch.ai/web')
    expect([...url.searchParams]).toEqual([
      ['query', query],
      ['num', '3']
    ])
    expect(options).toEqual({
      method: 'GET',
      headers: { Authorization: 'Bearer test-key' }
    })
    expect(result).toEqual({
      query,
      results: [
        { title: 'Example', url: 'https://example.org', content: 'Text' }
      ],
      images: [],
      number_of_results: 1
    })
  })

  it('uses the default count and handles empty results', async () => {
    vi.stubEnv('DESEARCH_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await new DesearchSearchProvider().search('empty')).toEqual({
      query: 'empty',
      results: [],
      images: [],
      number_of_results: 0
    })
    expect(fetchMock.mock.calls[0][0].searchParams.get('num')).toBe('10')
  })

  it('requires the environment key before making a request', async () => {
    vi.stubEnv('DESEARCH_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(new DesearchSearchProvider().search('query')).rejects.toThrow(
      'DESEARCH_API_KEY is not set'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([401, 429, 503])(
    'preserves HTTP status %s without response body',
    async status => {
      vi.stubEnv('DESEARCH_API_KEY', 'test-key')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('private body', { status }))
      )
      const error = await new DesearchSearchProvider()
        .search('query')
        .catch(error => error)
      expect(error.status).toBe(status)
      expect(error.message).toContain(`HTTP ${status}`)
      expect(error.message).not.toContain('private body')
    }
  )

  it('propagates transport errors without retrying', async () => {
    vi.stubEnv('DESEARCH_API_KEY', 'test-key')
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error('Network unavailable'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(new DesearchSearchProvider().search('query')).rejects.toThrow(
      'Network unavailable'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed JSON', async () => {
    vi.stubEnv('DESEARCH_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{')))
    await expect(new DesearchSearchProvider().search('query')).rejects.toThrow()
  })
})
