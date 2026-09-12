import { afterEach, describe, expect, it, vi } from 'vitest'

import { TavilySearchProvider } from '../tavily'

describe('TavilySearchProvider domains', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const searchAndReadBody = async (
    includeDomains: string[] = [],
    excludeDomains: string[] = [],
    query: string = 'query'
  ) => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key')
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({ results: [], images: [] })
    )
    vi.stubGlobal('fetch', fetchMock)

    await new TavilySearchProvider().search(
      query,
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

  it('converts internationalized domains to their ascii form', async () => {
    const body = await searchAndReadBody(['münchen.de'], ['*.MÜNCHEN.de'])

    expect(body.include_domains).toEqual(['xn--mnchen-3ya.de'])
    expect(body.exclude_domains).toEqual(['*.xn--mnchen-3ya.de'])
  })

  it('passes valid domains through untouched', async () => {
    const body = await searchAndReadBody(
      ['example.com', '*.example.org'],
      ['example.net']
    )

    expect(body.include_domains).toEqual(['example.com', '*.example.org'])
    expect(body.exclude_domains).toEqual(['example.net'])
  })

  it('converts a site-only query into a domain term and include_domains entry', async () => {
    const body = await searchAndReadBody([], [], 'site:example.com')

    expect(body.query).toBe('example.com')
    expect(body.include_domains).toEqual(['example.com'])
  })

  it('converts multiple site-only operators into domain terms', async () => {
    const body = await searchAndReadBody(
      ['existing.net'],
      [],
      'site:example.com SITE:example.org'
    )

    expect(body.query).toBe('example.com example.org')
    expect(body.include_domains).toEqual([
      'existing.net',
      'example.com',
      'example.org'
    ])
  })

  it('leaves a site operator combined with search terms unchanged', async () => {
    const query = 'site:example.com remodeling services'
    const body = await searchAndReadBody([], [], query)

    expect(body.query).toBe(query)
    expect(body.include_domains).toEqual([])
  })

  it('leaves a query without site operators unchanged', async () => {
    const query = 'remodeling services'
    const body = await searchAndReadBody([], [], query)

    expect(body.query).toBe(query)
    expect(body.include_domains).toEqual([])
  })

  it('leaves a site-only query whose domains are all invalid unchanged', async () => {
    const body = await searchAndReadBody([], [], 'site:edu')

    expect(body.query).toBe('site:edu')
    expect(body.include_domains).toEqual([])
  })

  it('punycodes an internationalized site-only operand', async () => {
    const body = await searchAndReadBody([], [], 'site:münchen.de')

    expect(body.query).toBe('xn--mnchen-3ya.de')
    expect(body.include_domains).toEqual(['xn--mnchen-3ya.de'])
  })

  it('leaves a site operand carrying a port unchanged', async () => {
    const query = 'site:example.com:8080'
    const body = await searchAndReadBody([], [], query)

    expect(body.query).toBe(query)
    expect(body.include_domains).toEqual([])
  })

  it('leaves a site operand carrying a path unchanged', async () => {
    const query = 'site:example.com/docs'
    const body = await searchAndReadBody([], [], query)

    expect(body.query).toBe(query)
    expect(body.include_domains).toEqual([])
  })

  it('keeps only the valid domains of a mixed site-only query', async () => {
    const body = await searchAndReadBody([], [], 'site:example.com site:edu')

    expect(body.query).toBe('example.com')
    expect(body.include_domains).toEqual(['example.com'])
  })
})
