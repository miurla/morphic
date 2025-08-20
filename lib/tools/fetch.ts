import { tool } from 'ai'

import { fetchSchema } from '@/lib/schema/fetch'
import { SearchResults as SearchResultsType } from '@/lib/types'

const CONTENT_CHARACTER_LIMIT = 10000
const TITLE_CHARACTER_LIMIT = 100

async function fetchRegularData(url: string): Promise<SearchResultsType> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(url, {
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
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('text/plain')
    ) {
      throw new Error(`Unsupported content type: ${contentType}`)
    }

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const rawTitle = titleMatch ? titleMatch[1].trim() : new URL(url).hostname
    const title =
      rawTitle.length > TITLE_CHARACTER_LIMIT
        ? rawTitle.substring(0, TITLE_CHARACTER_LIMIT) + '...'
        : rawTitle

    // Process HTML content
    let processedHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles

    // Replace img tags with alt text or [IMAGE] markers
    processedHtml = processedHtml
      .replace(/<img[^>]+alt\s*=\s*["']([^"']+)["'][^>]*>/gi, ' [IMAGE: $1] ')
      .replace(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi, ' [IMAGE] ')
      .replace(/<img[^>]*>/gi, ' [IMAGE] ')

    // Extract text content
    const textContent = processedHtml
      .replace(/<[^>]*>/g, ' ') // Remove remaining HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()

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
    console.error('Regular fetch error:', error)
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
    console.error('Jina Reader API error:', error)
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
      throw new Error('No results returned from Tavily Extract API')
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
    console.error('Tavily Extract API error:', error)
    throw error instanceof Error
      ? error
      : new Error('Tavily Extract API failed')
  }
}

export const fetchTool = tool({
  description:
    'Fetch content from any URL. By default uses "regular" type which performs fast, direct HTML fetching without external APIs - ideal for most websites. Only use "api" type when you need: 1) PDF content extraction, 2) Complex JavaScript-rendered pages, 3) Better markdown formatting, 4) Table extraction. The "api" type requires Jina or Tavily API keys.',
  inputSchema: fetchSchema,
  execute: async ({ url, type = 'regular' }) => {
    let results: SearchResultsType

    if (type === 'regular') {
      // Use regular fetch for direct HTML retrieval
      results = await fetchRegularData(url)
    } else {
      // Use API-based extraction (Jina or Tavily)
      const useJina = process.env.JINA_API_KEY
      if (useJina) {
        results = await fetchJinaReaderData(url)
      } else {
        results = await fetchTavilyExtractData(url)
      }
    }

    return results
  }
})
