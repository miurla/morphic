import { SearchResults } from '@/lib/types'

import { BaseSearchProvider } from './base'

interface OutcrawlSearchHit {
  url: string
  title?: string
  snippet?: string
  markdown?: string
}

interface OutcrawlSearchResponse {
  hits?: OutcrawlSearchHit[]
}

const matchesDomain = (hostname: string, domain: string) => {
  const bare = domain.trim().toLowerCase().replace(/^\*\./, '')
  return hostname === bare || hostname.endsWith(`.${bare}`)
}

const hostnameOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export class OutcrawlSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = []
  ): Promise<SearchResults> {
    const apiKey = process.env.OUTCRAWL_API_KEY
    this.validateApiKey(apiKey, 'OUTCRAWL')

    // Outcrawl has no domain filter parameters, so domains become search
    // operators and the hits are filtered again below.
    const siteFilter =
      includeDomains.length > 0
        ? includeDomains.map(domain => `site:${domain}`).join(' OR ')
        : ''
    const excludeFilter = excludeDomains
      .map(domain => `-site:${domain}`)
      .join(' ')
    const fullQuery = [query, siteFilter, excludeFilter]
      .filter(Boolean)
      .join(' ')

    // Advanced searches render every hit so the model gets page content.
    const scrape = searchDepth === 'advanced'

    const response = await fetch('https://api.outcrawl.ai/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: fullQuery,
        limit: maxResults,
        ...(scrape ? { scrape: true, formats: ['markdown'] } : {})
      })
    })

    if (!response.ok) {
      console.error(
        `Outcrawl API error: ${response.status} ${response.statusText}`
      )
      throw this.createHttpError(response, 'Outcrawl')
    }

    const data: OutcrawlSearchResponse = await response.json()

    const results = (data.hits ?? [])
      .filter(hit => {
        const hostname = hostnameOf(hit.url)
        if (!hostname) return false
        if (
          includeDomains.length > 0 &&
          !includeDomains.some(domain => matchesDomain(hostname, domain))
        ) {
          return false
        }
        return !excludeDomains.some(domain => matchesDomain(hostname, domain))
      })
      .map(hit => ({
        title: hit.title || '',
        url: hit.url,
        content: hit.markdown?.slice(0, 1000) || hit.snippet || ''
      }))

    return {
      results,
      query,
      images: [],
      number_of_results: results.length
    }
  }
}
