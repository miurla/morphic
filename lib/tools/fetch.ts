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

// PDFs take a different server-side pipeline: the /md endpoint drives a
// browser that cannot render them, so PDF URLs go to /crawl with the PDF
// scraping strategy, which swaps in crawl4ai's dedicated PDF crawler.
// The extension is the cheap test; a HEAD probe catches extensionless URLs
// like arxiv's /pdf/2310.06825, whose response is application/pdf. The probe
// runs through safeFetch so the connect-time guard covers it like any direct
// request this server makes.
async function isPdfUrl(url: string): Promise<boolean> {
  const path = new URL(url).pathname.toLowerCase()
  if (path.endsWith('.pdf')) {
    return true
  }
  try {
    const response = await safeFetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    })
    const contentType = response.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase()
    return contentType === 'application/pdf'
  } catch {
    return false
  }
}

async function fetchCrawl4aiData(url: string): Promise<SearchResultsType> {
  const baseUrl = process.env.CRAWL4AI_BASE_URL
  if (!baseUrl) {
    throw new Error('CRAWL4AI_BASE_URL is not configured')
  }

  const isPdf = await isPdfUrl(url)
  // PDFs download and parse server-side, which is slower than a page render.
  const timeoutMs = isPdf ? 60000 : 30000

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const endpoint = isPdf ? `${baseUrl}/crawl` : `${baseUrl}/md`
    const body = isPdf
      ? {
          urls: [url],
          crawler_config: {
            scraping_strategy: {
              type: 'PDFContentScrapingStrategy',
              params: {}
            }
          }
        }
      : { url, f: 'fit' }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CRAWL4AI_API_KEY ?? ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(
        `crawl4ai request failed: HTTP ${response.status} ${response.statusText}`
      )
    }

    const json = await response.json()
    // /md returns markdown as a string on the body; /crawl returns it inside
    // results[0].markdown, an object whose raw_markdown holds the extracted
    // text (fit_markdown is empty for PDFs, there is no HTML to prune).
    const crawlResult = isPdf ? json.results?.[0] : null
    const markdownSource = isPdf ? crawlResult?.markdown : json.markdown
    if (!json.success || !markdownSource) {
      throw new Error('No data returned from crawl4ai')
    }

    const markdown =
      typeof markdownSource === 'string'
        ? markdownSource
        : (markdownSource.raw_markdown ?? '')

    const content = markdown.slice(0, CONTENT_CHARACTER_LIMIT)
    const resultUrl = isPdf ? (crawlResult?.url ?? url) : (json.url ?? url)
    const rawTitle = new URL(resultUrl).hostname
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
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000} seconds`)
    }
    console.error('API Error:', error)
    throw error instanceof Error
      ? error
      : new Error('crawl4ai extraction failed')
  }
}

export function createFetchTool(options?: {
  labelAllocator?: CitationLabelAllocator
}) {
  const labelAllocator =
    options?.labelAllocator ?? createCitationLabelAllocator()

  return tool({
    description:
      'Fetch content from any URL. By default uses "regular" type which performs fast, direct HTML fetching without external APIs - ideal for most websites. IMPORTANT: "regular" type does NOT support PDFs and will fail on PDF URLs. Use "api" type when you need: 1) PDF content extraction (required for .pdf URLs), 2) Complex JavaScript-rendered pages, 3) Better markdown formatting, 4) Table extraction. The "api" type requires Jina, Tavily, or a self-hosted crawl4ai instance and uses crawl4ai if configured, otherwise Jina Reader if available, otherwise falls back to Tavily Extract. When a crawl4ai instance is configured, both regular and api fetches go through it.',
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
          await assertResolvedPublicUrl(url)
          results = await fetchCrawl4aiData(url)
        } else if (type === 'regular') {
          // Use regular fetch for direct HTML retrieval
          results = await fetchRegularData(url)
        } else {
          // The extraction service does the requesting here, so the name has to
          // be settled before it is handed over rather than at connect time.
          await assertResolvedPublicUrl(url)

          // Use API-based extraction (crawl4ai, Jina or Tavily)
          const crawl4aiBaseUrl = process.env.CRAWL4AI_BASE_URL
          const useJina = process.env.JINA_API_KEY
          if (crawl4aiBaseUrl) {
            results = await fetchCrawl4aiData(url)
          } else if (useJina) {
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
