import { NextResponse } from 'next/server'
import http from 'http'
import https from 'https'
import { JSDOM } from 'jsdom'
import {
  SearXNGSearchResults,
  SearXNGResponse,
  SearXNGResult,
  SearchResultItem
} from '@/lib/types'
import { Agent } from 'http'

export async function POST(request: Request) {
  const { query, maxResults, searchDepth, includeDomains, excludeDomains } =
    await request.json()

  try {
    const results = await advancedSearchXNGSearch(
      query,
      maxResults,
      searchDepth,
      includeDomains,
      excludeDomains
    )
    return NextResponse.json(results)
  } catch (error) {
    //console.error('Advanced search error:', error)
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

async function advancedSearchXNGSearch(
  query: string,
  maxResults: number = 10,
  searchDepth: 'basic' | 'advanced' = 'advanced',
  includeDomains: string[] = [],
  excludeDomains: string[] = []
): Promise<SearXNGSearchResults> {
  const apiUrl = process.env.SEARXNG_API_URL
  if (!apiUrl) {
    throw new Error('SEARXNG_API_URL is not set in the environment variables')
  }

  const maxAllowedResults = parseInt(
    process.env.SEARXNG_MAX_RESULTS || '50',
    10
  )
  maxResults = Math.min(maxResults, maxAllowedResults)

  try {
    const url = new URL(`${apiUrl}/search`)
    url.searchParams.append('q', query)
    url.searchParams.append('format', 'json')
    url.searchParams.append('categories', 'general,images')
    url.searchParams.append('time_range', '')
    url.searchParams.append('safesearch', '0')
    url.searchParams.append('engines', 'google,bing,duckduckgo,wikipedia')

    const resultsPerPage = 10
    const pageno = Math.ceil(maxResults / resultsPerPage)
    url.searchParams.append('pageno', String(pageno))

    // Note: includeDomains and excludeDomains are not used in the API call
    // but can be used for post-processing if needed

    const data: SearXNGResponse = await fetchJsonWithRetry(url.toString(), 3)

    let generalResults = data.results.filter(
      (result: SearXNGResult) => !result.img_src
    )

    // Apply domain filtering manually
    if (includeDomains.length > 0 || excludeDomains.length > 0) {
      generalResults = generalResults.filter(result => {
        const domain = new URL(result.url).hostname
        return (
          (includeDomains.length === 0 ||
            includeDomains.some(d => domain.includes(d))) &&
          (excludeDomains.length === 0 ||
            !excludeDomains.some(d => domain.includes(d)))
        )
      })
    }

    if (searchDepth === 'advanced') {
      const crawledResults = await Promise.allSettled(
        generalResults
          .slice(0, maxResults * 3) // Increase the number of results to crawl
          .map(result => crawlPage(result, query))
      )
      generalResults = crawledResults
        .filter(
          (result): result is PromiseFulfilledResult<SearXNGResult> =>
            result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value)

      // Score and sort results based on relevance
      generalResults = generalResults
        .map(result => ({
          ...result,
          score: calculateRelevanceScore(result, query)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
    }

    generalResults = generalResults.slice(0, maxResults)

    const imageResults = data.results
      .filter((result: SearXNGResult) => result.img_src)
      .slice(0, maxResults)

    return {
      results: generalResults.map(
        (result: SearXNGResult): SearchResultItem => ({
          title: result.title,
          url: result.url,
          content: result.content
        })
      ),
      query: data.query,
      images: imageResults
        .map((result: SearXNGResult) => {
          const imgSrc = result.img_src || ''
          return imgSrc.startsWith('http') ? imgSrc : `${apiUrl}${imgSrc}`
        })
        .filter(Boolean),
      number_of_results: data.number_of_results
    }
  } catch (error) {
    console.error('SearchXNG API error:', error)
    throw error
  }
}

async function crawlPage(
  result: SearXNGResult,
  query: string
): Promise<SearXNGResult | null> {
  try {
    const html = await fetchHtmlWithTimeout(result.url, 20000) // Increased timeout to 20 seconds
    const dom = new JSDOM(html, {
      runScripts: 'outside-only',
      resources: 'usable'
    })
    const document = dom.window.document

    // Remove script, style, nav, header, and footer elements
    document
      .querySelectorAll('script, style, nav, header, footer')
      .forEach((el: Element) => el.remove())

    // Extract main content
    const mainContent =
      document.querySelector('main') ||
      document.querySelector('article') ||
      document.body

    if (mainContent) {
      // Extract text from paragraphs, headings, list items, and tables
      const contentElements = mainContent.querySelectorAll(
        'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre, code'
      )
      let extractedText = Array.from(contentElements)
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join('\n\n')

      // Extract metadata
      const metaDescription =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute('content') || ''
      const metaKeywords =
        document
          .querySelector('meta[name="keywords"]')
          ?.getAttribute('content') || ''
      const ogTitle =
        document
          .querySelector('meta[property="og:title"]')
          ?.getAttribute('content') || ''
      const ogDescription =
        document
          .querySelector('meta[property="og:description"]')
          ?.getAttribute('content') || ''

      // Combine metadata with extracted text
      extractedText = `${result.title}\n\n${ogTitle}\n\n${metaDescription}\n\n${ogDescription}\n\n${metaKeywords}\n\n${extractedText}`

      // Limit the extracted text to 10000 characters
      extractedText = extractedText.substring(0, 10000)

      // Highlight query terms in the content
      result.content = highlightQueryTerms(extractedText, query)

      // Extract publication date
      const publishedDate = extractPublicationDate(document)
      if (publishedDate) {
        result.publishedDate = publishedDate.toISOString()
      }
    }

    return result
  } catch (error) {
    //console.error(`Error crawling ${result.url}:`, error)
    return null
  }
}

function highlightQueryTerms(content: string, query: string): string {
  try {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // Escape special characters

    let highlightedContent = content

    terms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi')
      highlightedContent = highlightedContent.replace(
        regex,
        match => `<mark>${match}</mark>`
      )
    })

    return highlightedContent
  } catch (error) {
    //console.error('Error in highlightQueryTerms:', error)
    return content // Return original content if highlighting fails
  }
}

function calculateRelevanceScore(result: SearXNGResult, query: string): number {
  try {
    const lowercaseContent = result.content.toLowerCase()
    const lowercaseQuery = query.toLowerCase()
    const queryWords = lowercaseQuery
      .split(/\s+/)
      .filter(word => word.length > 2)
      .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // Escape special characters

    let score = 0

    // Check for exact phrase match
    if (lowercaseContent.includes(lowercaseQuery)) {
      score += 30
    }

    // Check for individual word matches
    queryWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g')
      const wordCount = (lowercaseContent.match(regex) || []).length
      score += wordCount * 3
    })

    // Boost score for matches in the title
    const lowercaseTitle = result.title.toLowerCase()
    if (lowercaseTitle.includes(lowercaseQuery)) {
      score += 20
    }

    queryWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g')
      if (lowercaseTitle.match(regex)) {
        score += 10
      }
    })

    // Boost score for recent content (if available)
    if (result.publishedDate) {
      const publishDate = new Date(result.publishedDate)
      const now = new Date()
      const daysSincePublished =
        (now.getTime() - publishDate.getTime()) / (1000 * 3600 * 24)
      if (daysSincePublished < 30) {
        score += 15
      } else if (daysSincePublished < 90) {
        score += 10
      } else if (daysSincePublished < 365) {
        score += 5
      }
    }

    // Penalize very short content
    if (result.content.length < 200) {
      score -= 10
    } else if (result.content.length > 1000) {
      score += 5
    }

    // Boost score for content with more highlighted terms
    const highlightCount = (result.content.match(/<mark>/g) || []).length
    score += highlightCount * 2

    return score
  } catch (error) {
    //console.error('Error in calculateRelevanceScore:', error)
    return 0 // Return 0 if scoring fails
  }
}

function extractPublicationDate(document: Document): Date | null {
  const dateSelectors = [
    'meta[name="article:published_time"]',
    'meta[property="article:published_time"]',
    'meta[name="publication-date"]',
    'meta[name="date"]',
    'time[datetime]',
    'time[pubdate]'
  ]

  for (const selector of dateSelectors) {
    const element = document.querySelector(selector)
    if (element) {
      const dateStr =
        element.getAttribute('content') ||
        element.getAttribute('datetime') ||
        element.getAttribute('pubdate')
      if (dateStr) {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          return date
        }
      }
    }
  }

  return null
}

const httpAgent = new http.Agent({ keepAlive: true })
const httpsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: true // change to false if you want to ignore SSL certificate errors 
                           //but use this with caution.
})

async function fetchJsonWithRetry(url: string, retries: number): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchJson(url)
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http
    const agent = url.startsWith('https:') ? httpsAgent : httpAgent
    const request = protocol.get(url, { agent }, res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(e)
        }
      })
    })
    request.on('error', reject)
    request.on('timeout', () => {
      request.destroy()
      reject(new Error('Request timed out'))
    })
    request.setTimeout(15000) // 15 second timeout
  })
}

async function fetchHtmlWithTimeout(
  url: string,
  timeoutMs: number
): Promise<string> {
  return Promise.race([
    fetchHtml(url),
    timeout(timeoutMs, `Fetching ${url} timed out after ${timeoutMs}ms`)
  ])
}

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http
    const agent = url.startsWith('https:') ? httpsAgent : httpAgent
    const request = protocol.get(url, { agent }, res => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        // Handle redirects
        fetchHtml(new URL(res.headers.location, url).toString())
          .then(resolve)
          .catch(reject)
        return
      }
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', () => resolve(data))
    })
    request.on('error', error => {
      console.error(`Error fetching ${url}:`, error)
      reject(error)
    })
    request.on('timeout', () => {
      request.destroy()
      reject(new Error(`Request timed out for ${url}`))
    })
    request.setTimeout(10000) // 10 second timeout
  })
}

function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message))
    }, ms)
  })
}
