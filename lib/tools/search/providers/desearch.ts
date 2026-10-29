import type { SearchResults } from '@/lib/types'

import { BaseSearchProvider } from './base'

type DesearchResponse = {
  data: Array<{ title: string; link: string; snippet: string }>
}

export class DesearchSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    _searchDepth: 'basic' | 'advanced' = 'basic',
    _includeDomains: string[] = [],
    _excludeDomains: string[] = []
  ): Promise<SearchResults> {
    const apiKey = process.env.DESEARCH_API_KEY
    this.validateApiKey(apiKey, 'DESEARCH')

    const url = new URL('https://api.desearch.ai/web')
    url.searchParams.set('query', query)
    url.searchParams.set('num', String(maxResults))

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    if (!response.ok) {
      throw this.createHttpError(response, 'Desearch')
    }

    const data: DesearchResponse = await response.json()
    const results = data.data.map(({ title, link, snippet }) => ({
      title,
      url: link,
      content: snippet
    }))
    return { results, query, images: [], number_of_results: results.length }
  }
}
