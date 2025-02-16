import { tool } from 'ai'
import { retrieveSchema } from '@/lib/schema/retrieve'
import { SearchResults as SearchResultsType } from '@/lib/types'

const CONTENT_CHARACTER_LIMIT = 10000

async function fetchJinaReaderData(
  url: string
): Promise<SearchResultsType | null> {
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
      return null
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
    return null
  }
}

async function fetchTavilyExtractData(
  url: string
): Promise<SearchResultsType | null> {
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
      return null
    }

    const result = json.results[0]
    const content = result.raw_content.slice(0, CONTENT_CHARACTER_LIMIT)

    return {
      results: [
        {
          title: content.slice(0, 100),
          content,
          url: result.url
        }
      ],
      query: '',
      images: []
    }
  } catch (error) {
    console.error('Tavily Extract API error:', error)
    return null
  }
}

async function fetchSearch1APIData(
  url: string
): Promise<SearchResultsType | null> {
  try {
    const apiKey = process.env.SEARCH1API_API_KEY
    if (!apiKey) {
      console.error('Search1API API key is not set')
      return null
    }

    const response = await fetch('https://api.search1api.com/crawl', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    })

    const json = await response.json()
    if (!json.results) {
      return null
    }

    const content = json.results.content.slice(0, CONTENT_CHARACTER_LIMIT)

    return {
      results: [
        {
          title: json.results.title,
          content,
          url: json.results.link || url
        }
      ],
      query: '',
      images: []
    }
  } catch (error) {
    console.error('Search1API Crawl error:', error)
    return null
  }
}

export const retrieveTool = tool({
  description: 'Retrieve content from the web',
  parameters: retrieveSchema,
  execute: async ({ url }) => {
    let results: SearchResultsType | null

    // Use Search1API if SEARCH_API is set to search1api
    if (process.env.SEARCH_API === 'search1api') {
      results = await fetchSearch1APIData(url)
    } else if (process.env.JINA_API_KEY) {
      results = await fetchJinaReaderData(url)
    } else {
      results = await fetchTavilyExtractData(url)
    }

    if (!results) {
      return null
    }

    return results
  }
})
