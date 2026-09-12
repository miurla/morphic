import { SearchResults } from '@/lib/types'
import { sanitizeUrl } from '@/lib/utils'

import { BaseSearchProvider } from './base'

// Domains excluded system-wide in Morphic Cloud deployments. Tavily has
// started surfacing low-value aggregator/social pages (notably Instagram)
// that rarely help answer informational queries.
const CLOUD_EXCLUDED_DOMAINS = ['instagram.com']
// Tavily rejects the whole request when every entry of a domain list lacks a
// valid suffix, so bare labels are dropped before the call. Entries are first
// resolved to an ASCII hostname so internationalized domains survive.
const VALID_DOMAIN_PATTERN = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/

// Tavily rejects a query whose only content is `site:` operators, so those
// queries are rewritten into domain terms plus an include_domains entry. Only a
// bare hostname operand qualifies: a path, port or scheme carries a restriction
// include_domains cannot express, and dropping it would widen the search.
const SITE_OPERATOR_PATTERN = /^site:(\*\.)?[a-z0-9.-]+$/i

const extractSiteOnlyDomains = (query: string): string[] | null => {
  const tokens = query.trim().split(/\s+/)

  if (tokens.some(token => !SITE_OPERATOR_PATTERN.test(token))) {
    return null
  }

  return tokens.map(token => token.slice(5))
}

const toAsciiHostname = (domain: string): string => {
  try {
    return new URL(`https://${domain.trim()}`).hostname
  } catch {
    return ''
  }
}

const normalizeDomains = (domains: string[]) =>
  domains.map(toAsciiHostname).filter(domain => {
    const suffix = domain.split('.').at(-1) ?? ''
    return (
      VALID_DOMAIN_PATTERN.test(domain) &&
      suffix.length >= 2 &&
      !/^\d+$/.test(suffix)
    )
  })

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

    const siteOnlyDomains = extractSiteOnlyDomains(query)
    const validSiteDomains = siteOnlyDomains
      ? normalizeDomains(siteOnlyDomains)
      : []
    // Rewriting only when an operand survives validation keeps an unusable
    // restriction failing instead of turning it into an unrestricted search.
    const effectiveQuery = validSiteDomains.length
      ? validSiteDomains.join(' ')
      : query

    // Tavily API requires a minimum of 5 characters in the query
    const filledQuery =
      effectiveQuery.length < 5
        ? effectiveQuery + ' '.repeat(5 - effectiveQuery.length)
        : effectiveQuery

    const validIncludeDomains = [
      ...normalizeDomains(includeDomains),
      ...validSiteDomains
    ]

    const isCloudDeployment = process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
    const effectiveExcludeDomains = isCloudDeployment
      ? Array.from(new Set([...excludeDomains, ...CLOUD_EXCLUDED_DOMAINS]))
      : excludeDomains
    const validExcludeDomains = normalizeDomains(effectiveExcludeDomains)

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
        include_domains: validIncludeDomains,
        exclude_domains: validExcludeDomains
      })
    })

    if (!response.ok) {
      console.error(
        `Tavily API error: ${response.status} ${response.statusText}`
      )
      throw this.createHttpError(response, 'Tavily')
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
