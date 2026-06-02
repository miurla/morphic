import { afterEach, describe, expect, it, vi } from 'vitest'

import { DuckDuckGoSearchProvider } from '../duckduckgo'
import { QwantSearchProvider } from '../qwant'

describe('QwantSearchProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.SEARXNG_API_URL
  })

  it('routes searches through the Qwant engine in SearXNG', async () => {
    process.env.SEARXNG_API_URL = 'http://localhost:18080'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'morphic github',
        number_of_results: 2,
        results: [
          {
            title: 'Morphic GitHub',
            url: 'https://github.com/miurla/morphic',
            content: 'An AI-powered search engine.',
            img_src: ''
          },
          {
            title: 'Morphic screenshot',
            url: 'https://example.com/image',
            content: '',
            img_src: '/image-proxy?url=example'
          }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new QwantSearchProvider()
    const results = await provider.search('morphic github', 10, 'basic', [], [])

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.origin).toBe('http://localhost:18080')
    expect(url.pathname).toBe('/search')
    expect(url.searchParams.get('engines')).toBe('qwant')
    expect(url.searchParams.get('format')).toBe('json')
    expect(results.results).toEqual([
      {
        title: 'Morphic GitHub',
        url: 'https://github.com/miurla/morphic',
        content: 'An AI-powered search engine.'
      }
    ])
    expect(results.images).toEqual([
      'http://localhost:18080/image-proxy?url=example'
    ])
  })

  it('falls back to DuckDuckGo when SearXNG reports Qwant as unresponsive', async () => {
    process.env.SEARXNG_API_URL = 'http://localhost:18080'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: 'morphic',
          number_of_results: 0,
          results: [],
          unresponsive_engines: [['qwant', 'access denied']]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: 'morphic',
          number_of_results: 1,
          results: [
            {
              title: 'Morphic',
              url: 'https://www.morphic.sh/',
              content: 'Open-source AI search engine.',
              img_src: ''
            }
          ]
        })
      })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new QwantSearchProvider()
    const results = await provider.search('morphic', 10, 'basic', [], [])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('engines')).toBe(
      'qwant'
    )
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('engines')).toBe(
      'duckduckgo'
    )
    expect(results.results[0]?.url).toBe('https://www.morphic.sh/')
  })
})

describe('DuckDuckGoSearchProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.SEARXNG_API_URL
  })

  it('routes searches through the DuckDuckGo engine in SearXNG', async () => {
    process.env.SEARXNG_API_URL = 'http://localhost:18080'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'morphic github',
        number_of_results: 1,
        results: [
          {
            title: 'Morphic GitHub',
            url: 'https://github.com/miurla/morphic',
            content: 'An AI-powered search engine.',
            img_src: ''
          }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new DuckDuckGoSearchProvider()
    const results = await provider.search('morphic github', 10, 'basic', [], [])

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('engines')).toBe('duckduckgo')
    expect(results.results[0]?.url).toBe('https://github.com/miurla/morphic')
  })
})
