import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

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
  const pageResponse = {
    success: true,
    results: [
      {
        url,
        redirected_url: url,
        success: true,
        markdown: {
          fit_markdown: '# Fitted page\n\nBody text.',
          raw_markdown: '# Fitted page\n\nBody text.'
        },
        metadata: { title: 'Fitted page' }
      }
    ]
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

  type FetchMock = {
    mock: { calls: Array<[string | URL | Request, RequestInit?]> }
  }

  function crawlBody(call: 0 | 1): {
    urls: string[]
    crawler_config: Record<string, unknown>
  } {
    const fetchMock = globalThis.fetch as unknown as FetchMock
    return JSON.parse(fetchMock.mock.calls[call]?.[1]?.body as string) as {
      urls: string[]
      crawler_config: Record<string, unknown>
    }
  }

  async function runCrawl4ai(type: 'regular' | 'api' = 'api') {
    const result = fetchTool.execute?.(
      { url, type },
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
      () => new Response(JSON.stringify(pageResponse))
    )

    const result = fetchTool.execute?.(
      { url, type: 'regular' },
      { toolCallId: 'fetch', messages: [], context: {} }
    )
    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()
    await iterator.next()
    const complete = await iterator.next()

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${baseUrl}/crawl`)
    expect(complete.value).toMatchObject({
      state: 'complete',
      results: [
        {
          title: 'Fitted page',
          content: pageResponse.results[0].markdown.fit_markdown,
          url
        }
      ]
    })
  })

  it('renders pages with the fit generator on the first pass', async () => {
    fetchCrawl4ai(() => new Response(JSON.stringify(pageResponse)))

    await runCrawl4ai()

    expect(crawlBody(0).crawler_config).toMatchObject({
      markdown_generator: {
        type: 'DefaultMarkdownGenerator',
        params: {
          content_filter: { type: 'PruningContentFilterLXML', params: {} }
        }
      }
    })
  })

  it('retries a PDF with the dedicated strategy when the page pass yields nothing', async () => {
    const pdfUrl = 'https://example.com/paper.pdf'
    const crawlResponse = {
      success: true,
      results: [
        {
          url: pdfUrl,
          redirected_url: pdfUrl,
          success: true,
          markdown: { raw_markdown: 'PDF text content', fit_markdown: '' },
          metadata: { title: 'A Paper' }
        }
      ]
    }
    const fetchMock = fetchCrawl4ai(init =>
      JSON.parse(String(init?.body)).crawler_config.scraping_strategy
        ? new Response(JSON.stringify(crawlResponse))
        : new Response(
            JSON.stringify({
              success: true,
              results: [
                {
                  url: pdfUrl,
                  success: true,
                  markdown: { fit_markdown: '', raw_markdown: '' }
                }
              ]
            })
          )
    )

    const result = fetchTool.execute?.(
      { url: pdfUrl, type: 'regular' },
      { toolCallId: 'fetch', messages: [], context: {} }
    )
    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()
    await iterator.next()
    const complete = await iterator.next()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${baseUrl}/crawl`)
    expect(crawlBody(1).crawler_config).toMatchObject({
      scraping_strategy: { type: 'PDFContentScrapingStrategy', params: {} }
    })
    expect(complete.value).toMatchObject({
      state: 'complete',
      results: [{ title: 'A Paper', content: 'PDF text content', url: pdfUrl }]
    })
  })

  it('falls back to raw markdown when the fit pruner drops everything', async () => {
    const sparse = {
      success: true,
      results: [
        {
          url,
          success: true,
          markdown: { fit_markdown: '', raw_markdown: 'just a line' },
          metadata: null
        }
      ]
    }
    fetchCrawl4ai(() => new Response(JSON.stringify(sparse)))

    const complete = await runCrawl4ai()

    expect(complete.value).toMatchObject({
      results: [{ title: 'example.com', content: 'just a line' }]
    })
  })

  it('uses the redirected URL from the crawl result', async () => {
    const moved = {
      success: true,
      results: [
        {
          url,
          redirected_url: 'https://www.example.com/final',
          success: true,
          markdown: { fit_markdown: 'moved content' },
          metadata: null
        }
      ]
    }
    fetchCrawl4ai(() => new Response(JSON.stringify(moved)))

    const complete = await runCrawl4ai()

    expect(complete.value).toMatchObject({
      results: [{ url: 'https://www.example.com/final' }]
    })
  })

  it('posts the page pass to /crawl with fit mode', async () => {
    const fetchMock = fetchCrawl4ai(
      () => new Response(JSON.stringify(pageResponse))
    )

    await runCrawl4ai()

    expect(crawlBody(0).urls).toEqual([url])
  })

  it('prefers crawl4ai over Jina when both are configured', async () => {
    const fetchMock = fetchCrawl4ai(
      () => new Response(JSON.stringify(pageResponse))
    )
    vi.stubEnv('JINA_API_KEY', 'test-jina-key')

    await runCrawl4ai()

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${baseUrl}/crawl`)
  })

  it('normalizes a trailing slash on the configured base URL', async () => {
    const fetchMock = fetchCrawl4ai(
      () => new Response(JSON.stringify(pageResponse))
    )
    vi.stubEnv('CRAWL4AI_BASE_URL', `${baseUrl}/`)

    await runCrawl4ai()

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${baseUrl}/crawl`)
  })

  it('normalizes multiple trailing slashes on the configured base URL', async () => {
    const fetchMock = fetchCrawl4ai(
      () => new Response(JSON.stringify(pageResponse))
    )
    vi.stubEnv('CRAWL4AI_BASE_URL', `${baseUrl}///`)

    await runCrawl4ai()

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${baseUrl}/crawl`)
  })

  it('sends no Authorization header without an API key', async () => {
    const fetchMock = fetchCrawl4ai(
      () => new Response(JSON.stringify(pageResponse))
    )

    await runCrawl4ai()

    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty(
      'Authorization'
    )
  })

  it('tells the model both types read PDFs only when configured', () => {
    const unsupported = 'does NOT support PDFs'
    const describeTool = () => {
      const tool = createFetchTool()
      return `${tool.description} ${JSON.stringify(z.toJSONSchema(tool.inputSchema as z.ZodType))}`
    }

    expect(describeTool()).toContain(unsupported)

    vi.stubEnv('CRAWL4AI_BASE_URL', baseUrl)

    expect(describeTool()).not.toContain(unsupported)
  })

  it('sends the API key when one is configured', async () => {
    vi.stubEnv('CRAWL4AI_API_KEY', 'test-crawl4ai-key')
    const fetchMock = fetchCrawl4ai(
      () => new Response(JSON.stringify(pageResponse))
    )

    await runCrawl4ai()

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
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

  it('reports the server error when both passes yield nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = {
      success: true,
      results: [
        {
          url,
          success: false,
          error_message: 'seek of closed file',
          markdown: null
        }
      ]
    }
    fetchCrawl4ai(() => new Response(JSON.stringify(failing)))

    await expect(runCrawl4ai()).rejects.toThrow('seek of closed file')
  })

  it('refuses a private result URL reported by the crawler', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const internal = {
      success: true,
      results: [
        {
          url,
          redirected_url: 'http://169.254.169.254/latest/meta-data/',
          success: true,
          markdown: { fit_markdown: 'stolen credentials' },
          metadata: null
        }
      ]
    }
    fetchCrawl4ai(() => new Response(JSON.stringify(internal)))

    await expect(runCrawl4ai()).rejects.toThrow('Blocked fetch URL.')
  })
})
