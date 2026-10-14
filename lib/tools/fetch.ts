import { tool, UIToolInvocation } from 'ai'

import { INVALID_URL_SENTINEL, ToolFailureError } from '@/lib/errors/tool-error'
import { fetchSchema } from '@/lib/schema/fetch'
import { SearchResults as SearchResultsType } from '@/lib/types'
import {
  assignCitationLabels,
  type CitationLabelAllocator,
  createCitationLabelAllocator
} from '@/lib/utils/citation'
import {
  assertPublicUrl,
  assertResolvedPublicUrl,
  safeFetch
} from '@/lib/utils/safe-fetch'
import { logToolPayload } from '@/lib/utils/usage-logging'

const CONTENT_CHARACTER_LIMIT = 50000
const TITLE_CHARACTER_LIMIT = 100

// The model sometimes fills this argument with a description of what it wants
// rather than an address, so nothing downstream can assume it is one. Parsing
// alone is too weak a test: `new URL` reads `https:some-description` as a host
// named after the description, which would still be looked up.
function assertFetchableUrl(url: string): void {
  if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) {
    throw new ToolFailureError('fetch', INVALID_URL_SENTINEL)
  }
}

async function fetchRegularData(url: string): Promise<SearchResultsType> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await safeFetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Morphic/1.0)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    // The request above accepts anything, so refusing everything that is not
    // markup turns readable text into a dead end: a JSON endpoint is the usual
    // case. Structured bodies take the passthrough below instead of the markup
    // pipeline, whose tag stripping deletes any run between angle brackets.
    const mediaType = contentType.split(';', 1)[0].trim().toLowerCase()
    const isHtmlContent =
      mediaType === 'text/html' || mediaType === 'application/xhtml+xml'
    const isTextContent =
      mediaType === 'text/plain' ||
      mediaType === 'application/json' ||
      mediaType.endsWith('+json')

    if (!isHtmlContent && !isTextContent) {
      throw new Error(`Unsupported content type: ${contentType}`)
    }

    const body = await response.text()

    const titleMatch = isHtmlContent
      ? body.match(/<title[^>]*>([^<]*)<\/title>/i)
      : null
    const rawTitle = titleMatch ? titleMatch[1].trim() : new URL(url).hostname
    const title =
      rawTitle.length > TITLE_CHARACTER_LIMIT
        ? rawTitle.substring(0, TITLE_CHARACTER_LIMIT) + '...'
        : rawTitle

    const textContent = isHtmlContent
      ? body
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
          .replace(
            /<img[^>]+alt\s*=\s*["']([^"']+)["'][^>]*>/gi,
            ' [IMAGE: $1] '
          )
          .replace(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi, ' [IMAGE] ')
          .replace(/<img[^>]*>/gi, ' [IMAGE] ')
          .replace(/<[^>]*>/g, ' ') // Remove remaining HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
      : body

    // Limit content length
    const truncatedContent =
      textContent.length > CONTENT_CHARACTER_LIMIT
        ? textContent.substring(0, CONTENT_CHARACTER_LIMIT) + '...[truncated]'
        : textContent

    return {
      results: [
        {
          title,
          content: truncatedContent,
          url
        }
      ],
      query: '',
      images: []
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout after 10 seconds')
    }
    console.error('Fetch error:', error)
    throw error instanceof Error ? error : new Error('Unknown fetch error')
  }
}

async function fetchJinaReaderData(url: string): Promise<SearchResultsType> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-With-Generated-Alt': 'true'
      }
    })
    const json = await response.json()
    if (!json.data || json.data.length === 0) {
      throw new Error('No data returned from Jina Reader API')
    }

    const content = json.data.content.slice(0, CONTENT_CHARACTER_LIMIT)

    return {
      results: [
        {
          title: json.data.title,
          content,
          url: json.data.url
        }
      ],
      query: '',
      images: []
    }
  } catch (error) {
    console.error('API Error:', error)
    throw error instanceof Error ? error : new Error('Jina Reader API failed')
  }
}

async function fetchTavilyExtractData(url: string): Promise<SearchResultsType> {
  try {
    const apiKey = process.env.TAVILY_API_KEY
    const response = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ api_key: apiKey, urls: [url] })
    })
    const json = await response.json()
    if (!json.results || json.results.length === 0) {
      throw new Error('No results returned from content extraction service')
    }

    const result = json.results[0]
    const content = result.raw_content.slice(0, CONTENT_CHARACTER_LIMIT)

    return {
      results: [
        {
          title: content.slice(0, TITLE_CHARACTER_LIMIT),
          content,
          url: result.url
        }
      ],
      query: '',
      images: []
    }
  } catch (error) {
    console.error('API Error:', error)
    throw error instanceof Error
      ? error
      : new Error('Content extraction service failed')
  }
}

// Everything goes through the server's /crawl pipeline, in two deliberate
// passes. The first pass renders the page in a browser with the same fit
// filter the server's /md endpoint pins (DefaultMarkdownGenerator +
// PruningContentFilterLXML), and its response carries the content type and
// metadata the old /md string collapsed away. Chromium cannot render PDFs, so
// anything the first pass fails to extract gets a second pass with the PDF
// scraping strategy, which makes the server swap in its dedicated PDF crawler.
// Detection therefore happens through the configured backend: no request to
// the origin is made from Morphic itself, and a mis-suffixed URL costs one
// fast failed pass rather than misrouting the fetch.
interface Crawl4aiCrawlResult {
  url?: string
  redirected_url?: string | null
  success?: boolean
  error_message?: string | null
  metadata?: { title?: string | null } | null
  markdown?: {
    raw_markdown?: string | null
    fit_markdown?: string | null
  } | null
}

const CRAWL4AI_PAGE_TIMEOUT_MS = 30000
// PDFs download and parse server-side, which is slower than a page render.
const CRAWL4AI_PDF_TIMEOUT_MS = 60000

async function postCrawl4ai(
  baseUrl: string,
  url: string,
  crawlerConfig: Record<string, unknown>,
  timeoutMs: number
): Promise<{
  success?: boolean
  results?: Crawl4aiCrawlResult[]
}> {
  try {
    const response = await fetch(`${baseUrl}/crawl`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CRAWL4AI_API_KEY ?? ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ urls: [url], crawler_config: crawlerConfig }),
      // AbortSignal.timeout stays armed through body consumption, so a server
      // that sends headers and stalls mid-body still hits the deadline.
      signal: AbortSignal.timeout(timeoutMs)
    })

    if (!response.ok) {
      throw new Error(
        `crawl4ai request failed: HTTP ${response.status} ${response.statusText}`
      )
    }

    return await response.json()
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      throw new Error(
        `crawl4ai request timed out after ${timeoutMs / 1000} seconds`
      )
    }
    throw error
  }
}

function crawl4aiMarkdown(result: Crawl4aiCrawlResult): string {
  // fit_markdown is the pruned read the fit filter produces; it is empty for
  // PDFs (nothing to prune) and for sparse pages the pruner rejects, where the
  // raw conversion is still worth reading back.
  return result.markdown?.fit_markdown || result.markdown?.raw_markdown || ''
}

function crawl4aiSearchResults(
  url: string,
  result: Crawl4aiCrawlResult,
  markdown: string
): SearchResultsType {
  const content = markdown.slice(0, CONTENT_CHARACTER_LIMIT)
  const resultUrl = result.redirected_url || result.url || url
  // The server validated its own hops, but this URL is what comes back into
  // Morphic for display, so it gets the same public-space gate every URL in a
  // result must pass. It throws on a private or malformed reported target.
  assertPublicUrl(resultUrl)
  const rawTitle = result.metadata?.title?.trim() || new URL(resultUrl).hostname
  const title =
    rawTitle.length > TITLE_CHARACTER_LIMIT
      ? rawTitle.substring(0, TITLE_CHARACTER_LIMIT) + '...'
      : rawTitle

  return {
    results: [
      {
        title,
        content,
        url: resultUrl
      }
    ],
    query: '',
    images: []
  }
}

function crawl4aiPayload(json: {
  success?: boolean
  results?: Crawl4aiCrawlResult[]
}): { success: boolean; result: Crawl4aiCrawlResult; markdown: string } {
  // The envelope carries the request-level success; the per-URL result holds
  // the markdown, its own success, and any server-side error message.
  const result = json.results?.[0] ?? {}
  return {
    success: Boolean(json.success && result.success),
    result,
    markdown: crawl4aiMarkdown(result)
  }
}

async function fetchCrawl4aiData(url: string): Promise<SearchResultsType> {
  // Strip trailing slashes so `http://crawler:11235/` never degrades into
  // `//crawl`: this backend takes over every fetch, so a malformed route
  // would break all of them at once.
  const baseUrl = process.env.CRAWL4AI_BASE_URL?.replace(/\/+$/, '')
  if (!baseUrl) {
    throw new Error('CRAWL4AI_BASE_URL is not configured')
  }

  const first = crawl4aiPayload(
    await postCrawl4ai(
      baseUrl,
      url,
      {
        markdown_generator: {
          type: 'DefaultMarkdownGenerator',
          params: {
            content_filter: { type: 'PruningContentFilterLXML', params: {} }
          }
        }
      },
      CRAWL4AI_PAGE_TIMEOUT_MS
    )
  )
  if (first.success && first.markdown) {
    return crawl4aiSearchResults(url, first.result, first.markdown)
  }

  const second = crawl4aiPayload(
    await postCrawl4ai(
      baseUrl,
      url,
      { scraping_strategy: { type: 'PDFContentScrapingStrategy', params: {} } },
      CRAWL4AI_PDF_TIMEOUT_MS
    )
  )
  if (second.success && second.markdown) {
    return crawl4aiSearchResults(url, second.result, second.markdown)
  }

  // The second pass is the deliberate look, so its server-side message is the
  // most specific; fall back to the first pass's for context.
  throw new Error(
    second.result.error_message ||
      first.result.error_message ||
      'No data returned from crawl4ai'
  )
}

export function createFetchTool(options?: {
  labelAllocator?: CitationLabelAllocator
}) {
  const labelAllocator =
    options?.labelAllocator ?? createCitationLabelAllocator()

  // The PDF guidance must match the configured backend: a self-hosted
  // crawl4ai instance extracts PDFs on either type, while the plain HTML
  // path (and the Jina/Tavily extraction services behind "api") only serve
  // PDFs through "api". Without crawl4ai the description is byte-identical
  // to the one on main: deployments that never set the variable must not
  // see their prompts move with this change.
  const description = process.env.CRAWL4AI_BASE_URL
    ? 'Fetch content from any URL and get clean markdown back. Use "regular" (default) for web pages and "api" for pages that need advanced handling. PDFs are extracted and converted to text on either type. The "api" type also gives deeper extraction for complex JavaScript-rendered pages, better markdown formatting, and table extraction. When a crawl4ai instance is configured via CRAWL4AI_BASE_URL it serves both types; otherwise "api" uses Jina Reader if available and falls back to Tavily Extract.'
    : 'Fetch content from any URL. By default uses "regular" type which performs fast, direct HTML fetching without external APIs - ideal for most websites. IMPORTANT: "regular" type does NOT support PDFs and will fail on PDF URLs. Use "api" type when you need: 1) PDF content extraction (required for .pdf URLs), 2) Complex JavaScript-rendered pages, 3) Better markdown formatting, 4) Table extraction. The "api" type requires Jina or Tavily API keys and uses Jina Reader if available, otherwise falls back to Tavily Extract.'

  return tool({
    description,
    inputSchema: fetchSchema,
    async *execute({ url, type = 'regular' }) {
      assertFetchableUrl(url)
      // Ahead of the branch below, so an address the server must not reach is
      // refused whether it would be read here or handed to an extraction service.
      try {
        assertPublicUrl(url)
      } catch (error) {
        throw new ToolFailureError('fetch', error)
      }

      // Yield initial fetching state
      yield {
        state: 'fetching' as const,
        url
      }

      let results: SearchResultsType

      // Only the retrieval is wrapped: a yield rejects when the consumer stops
      // reading, and an aborted stream is not a failure of the page.
      try {
        if (process.env.CRAWL4AI_BASE_URL) {
          // A configured crawl4ai instance is the fetch backend for every
          // type: it takes over regular fetching too, not just API extraction.
          // Settlement before the handoff stops Morphic from pointing the
          // crawler at private space; the crawler's own redirect hops and
          // connected peers are guarded server-side (seed validation, the
          // pinning egress proxy for browser hops, per-hop validators for the
          // PDF crawler), and anything it reports back passes the public gate
          // again inside fetchCrawl4aiData before it reaches a result.
          await assertResolvedPublicUrl(url)
          results = await fetchCrawl4aiData(url)
        } else if (type === 'regular') {
          // Use regular fetch for direct HTML retrieval
          results = await fetchRegularData(url)
        } else {
          // The extraction service does the requesting here, so the name has to
          // be settled before it is handed over rather than at connect time.
          await assertResolvedPublicUrl(url)

          // Use API-based extraction (Jina or Tavily; crawl4ai, when
          // configured, already took the branch above for every type)
          const useJina = process.env.JINA_API_KEY
          if (useJina) {
            results = await fetchJinaReaderData(url)
          } else {
            results = await fetchTavilyExtractData(url)
          }
        }
      } catch (error) {
        throw new ToolFailureError('fetch', error)
      }

      if (Array.isArray(results.results)) {
        results.results = assignCitationLabels(
          results.results,
          labelAllocator.reserve(results.results.length)
        )
      }

      logToolPayload('fetch', url, { results: results.results })

      // Yield final results with complete state
      yield {
        state: 'complete' as const,
        ...results
      }
    }
  })
}

export const fetchTool = createFetchTool()

// Export type for UI tool invocation
export type FetchUIToolInvocation = UIToolInvocation<typeof fetchTool>
