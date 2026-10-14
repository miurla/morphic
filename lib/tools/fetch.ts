import { tool, UIToolInvocation } from 'ai'

import { INVALID_URL_SENTINEL, ToolFailureError } from '@/lib/errors/tool-error'
import { crawl4aiFetchSchema, fetchSchema } from '@/lib/schema/fetch'
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

// crawl4ai's /crawl is called in two passes: a browser render first, then the
// PDF scraping strategy for anything the render could not extract, since
// Chromium cannot render PDFs. Morphic itself never requests the origin.
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
  const apiKey = process.env.CRAWL4AI_API_KEY

  try {
    const response = await fetch(`${baseUrl}/crawl`, {
      method: 'POST',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ urls: [url], crawler_config: crawlerConfig }),
      // Unlike a cleared timer, this still fires while the body is being read.
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
  // fit_markdown is empty for PDFs and for sparse pages the pruner rejects.
  return result.markdown?.fit_markdown || result.markdown?.raw_markdown || ''
}

function crawl4aiSearchResults(
  url: string,
  result: Crawl4aiCrawlResult,
  markdown: string
): SearchResultsType {
  const content = markdown.slice(0, CONTENT_CHARACTER_LIMIT)
  const resultUrl = result.redirected_url || result.url || url
  // The crawler reports this URL, so it passes the same gate as any result.
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
  const result = json.results?.[0] ?? {}
  return {
    success: Boolean(json.success && result.success),
    result,
    markdown: crawl4aiMarkdown(result)
  }
}

async function fetchCrawl4aiData(url: string): Promise<SearchResultsType> {
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

  // crawl4ai serves both types, so its wording differs. The default wording
  // is what every other deployment's prompt carries and must not change here.
  const usesCrawl4ai = !!process.env.CRAWL4AI_BASE_URL
  const description = usesCrawl4ai
    ? 'Fetch content from any URL as clean markdown through a self-hosted crawl4ai instance. Web pages, JavaScript-rendered pages and PDFs are all supported, and the "regular" and "api" types behave the same.'
    : 'Fetch content from any URL. By default uses "regular" type which performs fast, direct HTML fetching without external APIs - ideal for most websites. IMPORTANT: "regular" type does NOT support PDFs and will fail on PDF URLs. Use "api" type when you need: 1) PDF content extraction (required for .pdf URLs), 2) Complex JavaScript-rendered pages, 3) Better markdown formatting, 4) Table extraction. The "api" type requires Jina or Tavily API keys and uses Jina Reader if available, otherwise falls back to Tavily Extract.'

  return tool({
    description,
    inputSchema: usesCrawl4ai ? crawl4aiFetchSchema : fetchSchema,
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
          // The name is settled before the handoff; redirect hops are the
          // crawler's to guard.
          await assertResolvedPublicUrl(url)
          results = await fetchCrawl4aiData(url)
        } else if (type === 'regular') {
          // Use regular fetch for direct HTML retrieval
          results = await fetchRegularData(url)
        } else {
          // The extraction service does the requesting here, so the name has to
          // be settled before it is handed over rather than at connect time.
          await assertResolvedPublicUrl(url)

          // Use API-based extraction (Jina or Tavily)
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
