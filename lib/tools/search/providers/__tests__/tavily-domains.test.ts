import { afterEach, describe, expect, it, vi } from 'vitest'

import { TavilySearchProvider } from '../tavily'

describe('TavilySearchProvider domains', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const searchAndReadBody = async (
    includeDomains: string[] = [],
    excludeDomains: string[] = []
  ) => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key')
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({ results: [], images: [] })
    )
    vi.stubGlobal('fetch', fetchMock)

    await new TavilySearchProvider().search(
      'query',
      5,
      'basic',
      includeDomains,
      excludeDomains
    )

    const init = fetchMock.mock.calls[0][1]
    return JSON.parse(init?.body as string)
  }

  it('drops bare TLDs from include_domains', async () => {
    const body = await searchAndReadBody(['edu', 'gov'])

    expect(body.include_domains).toEqual([])
  })

  it('keeps only valid entries in a mixed include_domains list', async () => {
    const body = await searchAndReadBody(['edu', 'mit.edu', 'gov'])

    expect(body.include_domains).toEqual(['mit.edu'])
  })

  it('filters exclude_domains including the cloud-injected domain', async () => {
    vi.stubEnv('MORPHIC_CLOUD_DEPLOYMENT', 'true')

    const body = await searchAndReadBody(
      ['example.org'],
      ['com', 'example.net']
    )

    expect(body.exclude_domains).toEqual(['example.net', 'instagram.com'])
  })

  it('passes valid domains through untouched', async () => {
    const body = await searchAndReadBody(
      ['example.com', '*.example.org'],
      ['example.net']
    )

    expect(body.include_domains).toEqual(['example.com', '*.example.org'])
    expect(body.exclude_domains).toEqual(['example.net'])
  })
})
