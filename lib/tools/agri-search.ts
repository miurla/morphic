import { tool } from 'ai'
import Parallel from 'parallel-web'

import { enrichQuery } from '@/lib/agri/query-enricher'
import { getSearchSchemaForModel } from '@/lib/schema/search'
import { getAllSources } from '@/lib/supabase/queries/sources'
import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/supabase/types'
import { SearchResultItem, SearchResults } from '@/lib/types'
import { getSearchToolDescription } from '@/lib/utils/search-config'

const TRUSTED_DOMAINS_CACHE_TTL_MS = 10 * 60 * 1000
const TARGET_RESULT_COUNT = 8
const FALLBACK_THRESHOLD = 4
const PARALLEL_DOMAIN_LIMIT = 200

type SourceType = 'trusted' | 'open'

type AgriSearchResultItem = SearchResultItem & {
  sourceType: SourceType
}

type ParallelSearchResponse = Awaited<ReturnType<Parallel['search']>>

let trustedDomainsCache:
  | {
      expiresAt: number
      domains: string[]
    }
  | undefined

function normalizeDomain(domain: string): string | null {
  const normalized = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    ?.split(':')[0]

  return normalized || null
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.hostname = parsed.hostname.replace(/^www\./, '').toLowerCase()
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return url.trim().toLowerCase().replace(/\/$/, '')
  }
}

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

function isTrustedUrl(url: string, trustedDomains: string[]): boolean {
  const hostname = getHostname(url)
  if (!hostname) return false

  return trustedDomains.some(
    domain => hostname === domain || hostname.endsWith(`.${domain}`)
  )
}

function uniqueDomains(domains: string[]): string[] {
  return Array.from(
    new Set(domains.map(normalizeDomain).filter((d): d is string => !!d))
  )
}

function createObjective(query: string): string {
  const compactQuery = query.trim().replace(/\s+/g, ' ').slice(0, 500)
  return `Find evidence-based agricultural sources that answer this user question: "${compactQuery}". Prioritize peer-reviewed research, university extension guidance, government or regulatory agencies, and international agricultural research institutes. Capture practical crop, region, climate, season, soil, and regulatory caveats when available.`
}

function createParallelClient(): Parallel {
  const apiKey = process.env.PARALLEL_API_KEY
  if (!apiKey) {
    throw new Error('PARALLEL_API_KEY is not set in the environment variables')
  }

  return new Parallel({ apiKey, timeout: 15000, maxRetries: 1 })
}

export async function getTrustedAgriDomains(): Promise<string[]> {
  const now = Date.now()
  if (trustedDomainsCache && trustedDomainsCache.expiresAt > now) {
    return trustedDomainsCache.domains
  }

  try {
    const db = await createClient()
    const sources = await getAllSources(db)
    const domains = uniqueDomains(sources.map(source => source.domain)).slice(
      0,
      PARALLEL_DOMAIN_LIMIT
    )

    trustedDomainsCache = {
      domains,
      expiresAt: now + TRUSTED_DOMAINS_CACHE_TTL_MS
    }

    return domains
  } catch (error) {
    console.warn('[AgriSearch] Failed to fetch trusted domains:', error)
    trustedDomainsCache = {
      domains: [],
      expiresAt: now + TRUSTED_DOMAINS_CACHE_TTL_MS
    }
    return []
  }
}

async function runParallelSearch({
  client,
  query,
  objective,
  mode,
  includeDomains,
  excludeDomains,
  maxResults,
  clientModel
}: {
  client: Parallel
  query: string
  objective: string
  mode: 'basic' | 'advanced'
  includeDomains: string[]
  excludeDomains: string[]
  maxResults: number
  clientModel: string
}): Promise<ParallelSearchResponse> {
  const cappedExcludeDomains = excludeDomains.slice(0, PARALLEL_DOMAIN_LIMIT)
  const cappedIncludeDomains = includeDomains.slice(
    0,
    Math.max(0, PARALLEL_DOMAIN_LIMIT - cappedExcludeDomains.length)
  )

  return client.search({
    objective,
    search_queries: [query],
    mode,
    client_model: clientModel,
    max_chars_total: 12000,
    advanced_settings: {
      max_results: maxResults,
      source_policy: {
        ...(cappedIncludeDomains.length > 0
          ? { include_domains: cappedIncludeDomains }
          : {}),
        ...(cappedExcludeDomains.length > 0
          ? { exclude_domains: cappedExcludeDomains }
          : {})
      }
    }
  })
}

function mapParallelResults({
  response,
  trustedDomains,
  sourceType
}: {
  response: ParallelSearchResponse
  trustedDomains: string[]
  sourceType: SourceType
}): AgriSearchResultItem[] {
  return response.results.map(result => {
    const published = result.publish_date
      ? `Published: ${result.publish_date}\n\n`
      : ''
    const content = `${published}${result.excerpts.join('\n\n')}`.trim()
    const actualSourceType = isTrustedUrl(result.url, trustedDomains)
      ? 'trusted'
      : sourceType

    return {
      title: result.title || result.url,
      url: result.url,
      content,
      sourceType: actualSourceType
    }
  })
}

function mergeResults(items: AgriSearchResultItem[]): AgriSearchResultItem[] {
  const seenUrls = new Set<string>()
  const merged: AgriSearchResultItem[] = []

  for (const item of items) {
    const normalizedUrl = normalizeUrl(item.url)
    if (seenUrls.has(normalizedUrl)) continue

    seenUrls.add(normalizedUrl)
    merged.push(item)
  }

  return merged.slice(0, TARGET_RESULT_COUNT)
}

function createCitationMap(
  results: SearchResultItem[]
): Record<number, SearchResultItem> {
  return results.reduce<Record<number, SearchResultItem>>(
    (acc, result, index) => {
      acc[index + 1] = result
      return acc
    },
    {}
  )
}

export async function runAgriSearch({
  query,
  maxResults = TARGET_RESULT_COUNT,
  searchDepth = 'basic',
  includeDomains = [],
  excludeDomains = [],
  modelId,
  toolCallId,
  userProfile
}: {
  query: string
  maxResults?: number
  searchDepth?: 'basic' | 'advanced'
  includeDomains?: string[]
  excludeDomains?: string[]
  modelId: string
  toolCallId?: string
  userProfile?: UserProfile | null
}): Promise<SearchResults> {
  const client = createParallelClient()
  const trustedDomains = await getTrustedAgriDomains()
  const additionalIncludeDomains = uniqueDomains(includeDomains)
  const excludeDomainFilter = uniqueDomains(excludeDomains)
  const includeDomainFilter =
    trustedDomains.length > 0 ? trustedDomains : additionalIncludeDomains
  const objective = createObjective(query)
  const mode = searchDepth === 'advanced' ? 'advanced' : 'basic'
  const targetResults = Math.min(
    maxResults || TARGET_RESULT_COUNT,
    TARGET_RESULT_COUNT
  )
  const enrichedQueries = await enrichQuery(query, userProfile)

  const primaryResponses = await Promise.all(
    enrichedQueries.map(enrichedQuery =>
      runParallelSearch({
        client,
        query: enrichedQuery,
        objective,
        mode,
        includeDomains: includeDomainFilter,
        excludeDomains: excludeDomainFilter,
        maxResults: TARGET_RESULT_COUNT,
        clientModel: modelId.replace(/^[^:]+:/, '')
      })
    )
  )

  const primaryItems = primaryResponses.flatMap(response =>
    mapParallelResults({
      response,
      trustedDomains,
      sourceType: includeDomainFilter.length > 0 ? 'trusted' : 'open'
    })
  )
  let mergedItems = mergeResults(primaryItems)
  let trustedResults = mergedItems.filter(
    item => item.sourceType === 'trusted'
  ).length

  const fallbackResponses: ParallelSearchResponse[] = []
  if (
    trustedDomains.length > 0 &&
    trustedResults < FALLBACK_THRESHOLD &&
    mergedItems.length < targetResults
  ) {
    const neededResults = targetResults - mergedItems.length
    fallbackResponses.push(
      ...(await Promise.all(
        enrichedQueries.map(enrichedQuery =>
          runParallelSearch({
            client,
            query: enrichedQuery,
            objective,
            mode,
            includeDomains: [],
            excludeDomains: excludeDomainFilter,
            maxResults: neededResults,
            clientModel: modelId.replace(/^[^:]+:/, '')
          })
        )
      ))
    )

    const fallbackItems = fallbackResponses.flatMap(response =>
      mapParallelResults({ response, trustedDomains, sourceType: 'open' })
    )
    mergedItems = mergeResults([...mergedItems, ...fallbackItems])
    trustedResults = mergedItems.filter(
      item => item.sourceType === 'trusted'
    ).length
  }

  const results = mergedItems
    .slice(0, targetResults)
    .map(({ sourceType: _sourceType, ...result }) => result)
  const searchIds = [...primaryResponses, ...fallbackResponses].map(
    response => response.search_id
  )
  const sessionIds = Array.from(
    new Set(
      [...primaryResponses, ...fallbackResponses].map(
        response => response.session_id
      )
    )
  )

  return {
    results,
    images: [],
    query,
    number_of_results: results.length,
    citationMap: createCitationMap(results),
    ...(toolCallId ? { toolCallId } : {}),
    metadata: {
      provider: 'parallel',
      enrichedQueries,
      trustedDomainsCount: trustedDomains.length,
      trustedResults,
      openWebResults: results.length - trustedResults,
      searchIds,
      sessionIds
    }
  }
}

export function createAgriSearchTool(
  fullModel: string,
  userProfile?: UserProfile | null
) {
  return tool({
    description: getSearchToolDescription(),
    inputSchema: getSearchSchemaForModel(fullModel),
    async *execute(
      {
        query,
        max_results = TARGET_RESULT_COUNT,
        search_depth = 'basic',
        include_domains = [],
        exclude_domains = []
      },
      context
    ) {
      yield {
        state: 'searching' as const,
        query
      }

      const searchResult = await runAgriSearch({
        query,
        maxResults: max_results,
        searchDepth: search_depth as 'basic' | 'advanced',
        includeDomains: include_domains,
        excludeDomains: exclude_domains,
        modelId: fullModel,
        toolCallId: context?.toolCallId,
        userProfile
      })

      yield {
        state: 'complete' as const,
        ...searchResult
      }
    }
  })
}
