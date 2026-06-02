import {
  SearchResultItem,
  SearchResults,
  SearXNGResponse,
  SearXNGResult
} from '@/lib/types'

import { BaseSearchProvider } from './base'

interface SearXNGEngineProviderOptions {
  engine: string
  label: string
  fallbackEngine?: {
    engine: string
    label: string
  }
}

export class SearXNGEngineSearchProvider extends BaseSearchProvider {
  constructor(private readonly options: SearXNGEngineProviderOptions) {
    super()
  }

  async search(
    query: string,
    maxResults: number = 10,
    searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = []
  ): Promise<SearchResults> {
    const apiUrl = process.env.SEARXNG_API_URL
    if (!apiUrl) {
      this.validateApiUrl(apiUrl, 'SEARXNG')
      throw new Error('SEARXNG_API_URL is not set in the environment variables')
    }

    let data = await this.fetchEngineResults(
      apiUrl,
      this.options.engine,
      this.options.label,
      query,
      searchDepth,
      includeDomains
    )

    if (
      this.options.fallbackEngine &&
      this.isEngineUnresponsive(data, this.options.engine)
    ) {
      console.warn(
        `${this.options.label} via SearXNG was unresponsive; falling back to ${this.options.fallbackEngine.label}.`
      )
      data = await this.fetchEngineResults(
        apiUrl,
        this.options.fallbackEngine.engine,
        this.options.fallbackEngine.label,
        query,
        searchDepth,
        includeDomains
      )
    }

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

  private async fetchEngineResults(
    apiUrl: string,
    engine: string,
    label: string,
    query: string,
    searchDepth: 'basic' | 'advanced',
    includeDomains: string[]
  ): Promise<SearXNGResponse> {
    const url = new URL('/search', apiUrl)
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('categories', 'general,images')
    url.searchParams.set('engines', engine)
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
      console.error(`${label} via SearXNG error (${response.status}):`, errorText)
      throw new Error(`${label} search failed`)
    }

    return response.json()
  }

  private isEngineUnresponsive(
    data: SearXNGResponse,
    engine: string
  ): boolean {
    return Boolean(
      data.unresponsive_engines?.some(([name]) => name === engine)
    )
  }
}
