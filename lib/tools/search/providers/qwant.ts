import {
  SearchResultItem,
  SearchResults,
  SearXNGResponse,
  SearXNGResult
} from '@/lib/types'

import { BaseSearchProvider } from './base'

export class QwantSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = []
  ): Promise<SearchResults> {
    const apiUrl = process.env.SEARXNG_API_URL
    this.validateApiUrl(apiUrl, 'SEARXNG')

    const url = new URL('/search', apiUrl)
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('categories', 'general,images')
    url.searchParams.set('engines', 'qwant')
    url.searchParams.set('safesearch', searchDepth === 'advanced' ? '0' : '1')

    if (includeDomains.length > 0) {
      url.searchParams.set('site', includeDomains.join(','))
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Qwant via SearXNG error (${response.status}):`, errorText)
      throw new Error('Qwant search failed')
    }

    const data: SearXNGResponse = await response.json()
    const excluded = excludeDomains.map(domain => domain.toLowerCase())
    const matchesExcludedDomain = (result: SearXNGResult) =>
      excluded.some(domain => {
        try {
          return new URL(result.url).hostname.toLowerCase().includes(domain)
        } catch {
          return false
        }
      })

    const generalResults = data.results
      .filter(result => !result.img_src)
      .filter(result => !matchesExcludedDomain(result))
      .slice(0, maxResults)
    const imageResults = data.results
      .filter(result => result.img_src)
      .filter(result => !matchesExcludedDomain(result))
      .slice(0, maxResults)

    return {
      results: generalResults.map(
        (result: SearXNGResult): SearchResultItem => ({
          title: result.title,
          url: result.url,
          content: result.content
        })
      ),
      query: data.query || query,
      images: imageResults
        .map(result => {
          const imgSrc = result.img_src || ''
          return imgSrc.startsWith('http') ? imgSrc : `${apiUrl}${imgSrc}`
        })
        .filter(Boolean),
      number_of_results: data.number_of_results
    }
  }
}
