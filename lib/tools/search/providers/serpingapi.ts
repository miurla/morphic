import { SearchResults } from '@/lib/types'

import { BaseSearchProvider } from './base'

interface SerpingApiOrganicResult {
  title?: string
  link: string
  snippet?: string
  position?: number
}

export class SerpingApiSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    _searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = []
  ): Promise<SearchResults> {
    const apiKey = process.env.SERPINGAPI_API_KEY
    this.validateApiKey(apiKey, 'SERPINGAPI')

    const response = await fetch('https://api.serpingapi.com/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        q: query,
        num: Math.min(Math.max(maxResults, 1), 100)
        // Note: the Serping API does not support includeDomains/excludeDomains
      })
    })

    if (!response.ok) {
      console.error(
        `Serping API error: ${response.status} ${response.statusText}`
      )
      throw this.createHttpError(response, 'Serping API')
    }

    const data = await response.json()
    const results = ((data.organic as SerpingApiOrganicResult[]) ?? [])
      .filter(result => result.link)
      .slice(0, maxResults)
      .map(result => ({
        title: result.title || 'No title',
        url: result.link,
        content: result.snippet || ''
      }))

    return {
      results,
      query,
      images: [],
      number_of_results: results.length
    }
  }
}
