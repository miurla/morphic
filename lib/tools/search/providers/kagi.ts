import { SearchResults } from '@/lib/types'

import { BaseSearchProvider } from './base'

interface KagiResult {
  url: string
  title: string
  snippet: string
  published?: string
}

interface KagiResponse {
  meta: {
    id: string
    node: string
    ms: number
    api_balance: number
  }
  data: KagiResult[]
  error?: {
    code: number
    msg: string
    ref: string
  }[]
}

export class KagiSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = [],
    options?: {
      type?: 'general' | 'optimized'
      content_types?: Array<'web' | 'video' | 'image' | 'news'>
    }
  ): Promise<SearchResults> {
    const apiKey = process.env.KAGI_SEARCH_API_KEY
    this.validateApiKey(apiKey, 'KAGI_SEARCH')

    // Using the search endpoint
    const endpoint = 'https://kagi.com/api/v0/search'

    const url = new URL(endpoint)
    url.searchParams.append('q', query)
    url.searchParams.append('limit', Math.min(maxResults, 100).toString())

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(
          `Kagi API error: ${response.status} ${response.statusText}`
        )
      }

      const data: KagiResponse = await response.json()

      if (data.error && data.error.length > 0) {
        throw new Error(`Kagi API returned error: ${data.error[0].msg}`)
      }

      const results = (data.data || []).map(result => ({
        title: result.title,
        url: result.url,
        content: result.snippet || ''
      }))

      // For 'general' type searches with specific content types
      // Kagi does not separate images natively in the same endpoint response
      // so we rely on the snippet as fallback content
      return {
        results,
        query,
        images: [],
        number_of_results: results.length
      }
    } catch (error) {
      console.error('KagiSearchProvider error:', error)
      return {
        results: [],
        query,
        images: [],
        number_of_results: 0
      }
    }
  }
}
