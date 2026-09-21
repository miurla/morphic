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

// Tavily rejects a query made only of `site:` operators. Path terms are kept
// in the query since include_domains can only express their hostnames.
const SITE_OPERATOR_PATTERN = /^site:[^\s/:?#@\\]+(?:\/\S*)?$/i

const extractSiteOnlyOperands = (
  query: string
): Array<{ host: string; path: string }> | null => {
  const tokens = query.trim().split(/\s+/)

  if (tokens.some(token => !SITE_OPERATOR_PATTERN.test(token))) {
    return null
  }

  return tokens.map(token => {
    const operand = token.slice(5)
    const pathStart = operand.indexOf('/')

    return pathStart === -1
      ? { host: operand, path: '' }
      : {
          host: operand.slice(0, pathStart),
          path: operand.slice(pathStart + 1)
        }
  })
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

// A trailing extension is dropped, but only when an alphabetic suffix follows a
// nonempty stem, so `/.well-known` and version slugs like `/v1.2` survive.
const pathToSearchTerms = (path: string): string =>
  path
    .replace(/([^/.])\.[a-z]{1,8}$/i, '$1')
    .replace(/(?:%20|[/_.+-])+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

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

    const siteOnlyOperands = extractSiteOnlyOperands(query)
    const validSiteOperands = siteOnlyOperands
      ? siteOnlyOperands.flatMap(({ host, path }) => {
          const [domain] = normalizeDomains([host])
          return domain ? [{ domain, path }] : []
        })
      : []
    const validSiteDomains = validSiteOperands.map(({ domain }) => domain)
    const effectiveQuery = validSiteOperands.length
      ? validSiteOperands
          .map(({ domain, path }) => pathToSearchTerms(path) || domain)
          .join(' ')
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
