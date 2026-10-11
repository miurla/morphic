import { afterEach, describe, expect, it, vi } from 'vitest'

import { createFetchTool, fetchTool } from '@/lib/tools/fetch'
import { createCitationLabelAllocator } from '@/lib/utils/citation'

const url = 'https://example.com/resource'

async function fetchRegular(body: string, contentType: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(body, { headers: { 'content-type': contentType } })
    )
  )

  const result = fetchTool.execute?.(
    { url, type: 'regular' },
    { toolCallId: 'fetch', messages: [], context: {} }
  )
  const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()

  await iterator.next()
  return iterator.next()
}

describe('regular fetch content types', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns JSON verbatim', async () => {
    const body = '{\n  "markup": "<value>",\n  "spaced": "a   b"\n}'
    const result = await fetchRegular(body, 'application/json; charset=utf-8')

    expect(result.value).toMatchObject({
      results: [{ content: body, title: 'example.com', url }],
      state: 'complete'
    })
  })

  it('accepts structured JSON media types', async () => {
    const result = await fetchRegular('{"data":[]}', 'application/vnd.api+json')

    expect(result.value).toMatchObject({ state: 'complete' })
  })

  it('returns plain text without tag stripping', async () => {
    const body = 'Keep <literal> tags and   whitespace.'
    const result = await fetchRegular(body, 'text/plain')

    expect(result.value).toMatchObject({ results: [{ content: body }] })
  })

  it('continues to process HTML content', async () => {
    const result = await fetchRegular(
      '<html><title>Page title</title><body>Hello <strong>world</strong><script>bad()</script></body></html>',
      'text/html'
    )

    expect(result.value).toMatchObject({
      results: [{ content: 'Page title Hello world', title: 'Page title' }]
    })
  })

  it('labels results from the allocator seed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('Fetched body', {
            headers: { 'content-type': 'text/plain' }
          })
      )
    )
    const tool = createFetchTool({
      labelAllocator: createCitationLabelAllocator(7)
    })
    const result = tool.execute?.(
      { url, type: 'regular' },
      { toolCallId: 'fetch', messages: [], context: {} }
    )
    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()

    await iterator.next()
    const complete = await iterator.next()

    expect(complete.value).toMatchObject({
      results: [{ label: 'S7', url }],
      state: 'complete'
    })
  })

  it('rejects unsupported content types', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = fetchRegular('PDF', 'application/pdf')

    await expect(result).rejects.toThrow(
      'Unsupported content type: application/pdf'
    )
  })
})

describe('crawl4ai extraction', () => {
  const baseUrl = 'http://crawl4ai.internal:11235'
  const mdResponse = {
    url,
    filter: 'fit',
    query: null,
    cache: '0',
    markdown: '# Fitted page\n\nBody text.',
    success: true
  }

  function fetchCrawl4ai(handler: (init: RequestInit) => Response) {
    type FetchLike = (
      url: string | URL | Request,
      init?: RequestInit
    ) => Promise<Response>
    const fetchMock = vi.fn<FetchLike>(async (_url, init) =>
      handler(init ?? {})
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('CRAWL4AI_BASE_URL', baseUrl)
    return fetchMock
  }

  async function runCrawl4ai() {
    const result = fetchTool.execute?.(
      { url, type: 'api' },
      { toolCallId: 'fetch', messages: [], context: {} }
    )
    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()

    await iterator.next()
    return iterator.next()
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('routes regular-type fetches through crawl4ai when configured', async () => {
    const fetchMock = fetchCrawl4ai(
      () => new Response(JSON.stringify(mdResponse))
    )

    const result = fetchTool.execute?.(
      { url, type: 'regular' },
      { toolCallId: 'fetch', messages: [], context: {} }
    )
    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()
    await iterator.next()
    const complete = await iterator.next()

    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${baseUrl}/md`)
    expect(complete.value).toMatchObject({
      state: 'complete',
      results: [{ title: 'example.com', content: mdResponse.markdown, url }]
    })
  })

  it('routes .pdf URLs to the /crawl endpoint with the PDF strategy', async () => {
    const pdfUrl = 'https://example.com/paper.pdf'
    const crawlResponse = {
      success: true,
      results: [
        {
          url: pdfUrl,
          success: true,
          markdown: { raw_markdown: 'PDF text content', fit_markdown: '' },
          metadata: { title: 'A Paper' }
        }
      ]
    }
    const fetchMock = fetchCrawl4ai(
      () => new Response(JSON.stringify(crawlResponse))
    )

    const result = fetchTool.execute?.(
      { url: pdfUrl, type: 'regular' },
      { toolCallId: 'fetch', messages: [], context: {} }
    )
    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()
    await iterator.next()
    const complete = await iterator.next()

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${baseUrl}/crawl`)
    expect(
      JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    ).toMatchObject({
      urls: [pdfUrl],
      crawler_config: {
        scraping_strategy: { type: 'PDFContentScrapingStrategy', params: {} }
      }
    })
    expect(complete.value).toMatchObject({
      state: 'complete',
      results: [
        { title: 'example.com', content: 'PDF text content', url: pdfUrl }
      ]
    })
  })

  it('probes content type for extensionless PDF URLs', async () => {
    const pdfUrl = 'https://arxiv.org/pdf/2310.06825'
    const crawlResponse = {
      success: true,
      results: [
        {
          url: pdfUrl,
          success: true,
          markdown: { raw_markdown: 'Paper text' }
        }
      ]
    }
    const fetchMock = fetchCrawl4ai(init =>
      init?.method === 'HEAD'
        ? new Response(null, { headers: { 'content-type': 'application/pdf' } })
        : new Response(JSON.stringify(crawlResponse))
    )

    const result = fetchTool.execute?.(
      { url: pdfUrl, type: 'regular' },
      { toolCallId: 'fetch', messages: [], context: {} }
    )
    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()
    await iterator.next()
    const complete = await iterator.next()

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('HEAD')
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${baseUrl}/crawl`)
    expect(complete.value).toMatchObject({
      results: [{ content: 'Paper text' }]
    })
  })

  it('posts to the /md endpoint with fit mode', async () => {
    const fetchMock = fetchCrawl4ai(
      () => new Response(JSON.stringify(mdResponse))
    )

    const result = await runCrawl4ai()

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/md`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ url, f: 'fit' })
      })
    )
    expect(result.value).toMatchObject({
      state: 'complete',
      results: [{ title: 'example.com', content: mdResponse.markdown, url }]
    })
  })

  it('prefers crawl4ai over Jina when both are configured', async () => {
    const fetchMock = fetchCrawl4ai(
      () => new Response(JSON.stringify(mdResponse))
    )
    vi.stubEnv('JINA_API_KEY', 'test-jina-key')

    await runCrawl4ai()

    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${baseUrl}/md`)
  })

  it('sends the API key when one is configured', async () => {
    vi.stubEnv('CRAWL4AI_API_KEY', 'test-crawl4ai-key')
    const fetchMock = fetchCrawl4ai(
      () => new Response(JSON.stringify(mdResponse))
    )

    await runCrawl4ai()

    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer test-crawl4ai-key'
    })
  })

  it('falls back to Tavily Extract without CRAWL4AI_BASE_URL', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    type FetchLike = (url: string | URL | Request) => Promise<Response>
    const fetchMock = vi.fn<FetchLike>(
      async () => new Response(JSON.stringify({ results: [] }), { status: 403 })
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('TAVILY_API_KEY', 'test-tavily-key')

    await expect(runCrawl4ai()).rejects.toThrow(
      'No results returned from content extraction service'
    )
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.tavily.com/extract')
  })

  it('keeps regular fetches direct without CRAWL4AI_BASE_URL', async () => {
    type FetchLike = (url: string | URL | Request) => Promise<Response>
    const fetchMock = vi.fn<FetchLike>(
      async () =>
        new Response(
          '<html><title>Page title</title><body>Hello</body></html>',
          {
            headers: { 'content-type': 'text/html' }
          }
        )
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = fetchTool.execute?.(
      { url, type: 'regular' },
      { toolCallId: 'fetch', messages: [], context: {} }
    )
    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()
    await iterator.next()
    const complete = await iterator.next()

    expect(fetchMock.mock.calls[0]?.[0]).toBe(url)
    expect(complete.value).toMatchObject({
      results: [{ content: 'Page title Hello' }]
    })
  })

  it('rejects an unsuccessful crawl4ai response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchCrawl4ai(
      () => new Response(JSON.stringify({ detail: 'boom' }), { status: 500 })
    )

    await expect(runCrawl4ai()).rejects.toThrow(
      'crawl4ai request failed: HTTP 500'
    )
  })

  it('rejects a success response without markdown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchCrawl4ai(
      () => new Response(JSON.stringify({ url, success: true, markdown: '' }))
    )

    await expect(runCrawl4ai()).rejects.toThrow(
      'No data returned from crawl4ai'
    )
  })
})
