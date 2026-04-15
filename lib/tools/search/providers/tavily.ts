import { SearchResults } from '@/lib/types'
import { sanitizeUrl } from '@/lib/utils'

import { BaseSearchProvider } from './base'

// Domains excluded system-wide in Morphic Cloud deployments. Tavily has
// started surfacing low-value aggregator/social pages (notably Instagram)
// that rarely help answer informational queries.
const CLOUD_EXCLUDED_DOMAINS = ['instagram.com']

export class TavilySearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = []
  ): Promise<SearchResults> {
    const apiKey = process.env.TAVILY_API_KEY
    this.validateApiKey(apiKey, 'TAVILY')

    // Tavily API requires a minimum of 5 characters in the query
    const filledQuery =
      query.length < 5 ? query + ' '.repeat(5 - query.length) : query

    const isCloudDeployment = process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
    const effectiveExcludeDomains = isCloudDeployment
      ? Array.from(new Set([...excludeDomains, ...CLOUD_EXCLUDED_DOMAINS]))
      : excludeDomains

    const includeImageDescriptions = true
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: filledQuery,
        max_results: Math.max(maxResults, 5),
        search_depth: searchDepth,
        include_images: true,
        include_image_descriptions: includeImageDescriptions,
        include_answers: true,
        include_domains: includeDomains,
        exclude_domains: effectiveExcludeDomains
      })
    })

    if (!response.ok) {
      console.error(
        `Tavily API error: ${response.status} ${response.statusText}`
      )
      throw new Error('Search failed')
    }

    const data = await response.json()

    // Tavily returns top-level images with { url, title?, description? }. We try
    // to match each image to a result by title so the UI can link back to the
    // original article rather than just the image host.
    const resultTitleToUrl = new Map<string, string>()
    for (const r of (data.results ?? []) as Array<{
      title?: string
      url?: string
    }>) {
      if (r.title && r.url) {
        resultTitleToUrl.set(r.title, r.url)
      }
    }

    const processedImages = includeImageDescriptions
      ? (
          data.images as Array<{
            url: string
            title?: string
            description?: string
          }>
        )
          .map(image => {
            const sourceUrl = image.title
              ? resultTitleToUrl.get(image.title)
              : undefined
            return {
              url: sanitizeUrl(image.url),
              description: image.description ?? '',
              ...(image.title ? { title: image.title } : {}),
              ...(sourceUrl ? { sourceUrl } : {})
            }
          })
          .filter(
            (image): image is { url: string; description: string } =>
              typeof image === 'object' &&
              image.description !== undefined &&
              image.description !== ''
          )
      : data.images.map((url: string) => sanitizeUrl(url))

    return {
      ...data,
      images: processedImages
    }
  }
}
