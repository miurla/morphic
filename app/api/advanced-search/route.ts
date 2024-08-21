import { NextResponse } from 'next/server'
import http from 'http'
import https from 'https'
import { parse } from 'node-html-parser'
import {
  SearchResults,
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
    console.error('Advanced search error:', error)
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
): Promise<SearchResults> {
  const apiUrl = process.env.SEARXNG_API_URL
  if (!apiUrl) {
    throw new Error('SEARXNG_API_URL is not set in the environment variables')
  }

  const maxAllowedResults = parseInt(process.env.SEARXNG_MAX_RESULTS || '50', 10)
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
        generalResults.slice(0, maxResults).map(result => crawlPage(result))
      )
      generalResults = crawledResults
        .filter(
          (result): result is PromiseFulfilledResult<SearXNGResult> =>
            result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value)
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

async function crawlPage(result: SearXNGResult): Promise<SearXNGResult | null> {
  try {
    const html = await fetchHtmlWithTimeout(result.url, 10000) // 10 second timeout
    const root = parse(html)
    const body = root.querySelector('body')
    if (body) {
      const text = body.textContent.replace(/\s+/g, ' ').trim()
      const extractedText = text.substring(0, 2000)
      result.content = `${result.content}\n\nAdditional content:\n${extractedText}`
    }
    return result
  } catch (error) {
    console.error(`Error crawling ${result.url}:`, error)
    return null
  }
}

const httpAgent = new http.Agent({ keepAlive: true })
const httpsAgent = new https.Agent({ keepAlive: true })

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
    request.on('error', reject)
    request.on('timeout', () => {
      request.destroy()
      reject(new Error('Request timed out'))
    })
    request.setTimeout(5000) // 5 second timeout
  })
}

function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message))
    }, ms)
  })
}