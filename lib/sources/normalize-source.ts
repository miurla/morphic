import type { SearchResultItem, SearchResults } from '@/lib/types'
import type { FeedItem, FeedSearchResults, ParsedFeed } from '@/lib/types/feed'

import {
  canonicalizeSourceUrl,
  createSourceId,
  extractSourceDomain,
  normalizeSourceDate,
  normalizeSourceText
} from './source-metadata'
import type {
  NormalizedSource,
  SourceKind,
  SourceRetrievalMethod
} from './source-types'

interface NormalizeSourceOptions {
  provider?: string
  retrievalQuery?: string
}

interface BaseSourceInput {
  kind?: SourceKind
  title?: string
  url?: string
  siteName?: string
  summary?: string
  snippet?: string
  author?: string
  publishedAt?: string | Date
  updatedAt?: string | Date
  imageUrl?: string
  faviconUrl?: string
  language?: string
  provider?: string
  retrievalMethod: SourceRetrievalMethod
  retrievalQuery?: string
  rank?: number
  score?: number
  sourcePreference?: SearchResultItem['sourcePreference']
  entities?: SearchResultItem['entities']
  raw?: unknown
}

function inferKindFromUrl(url?: string): SourceKind {
  const canonicalUrl = canonicalizeSourceUrl(url)
  if (!canonicalUrl) {
    return 'unknown'
  }

  const pathname = new URL(canonicalUrl).pathname.toLowerCase()

  if (pathname.endsWith('.pdf')) {
    return 'pdf'
  }

  return 'web'
}

function createNormalizedSource(input: BaseSourceInput): NormalizedSource {
  const canonicalUrl = canonicalizeSourceUrl(input.url)
  const url = canonicalUrl ?? normalizeSourceText(input.url)
  const domain = canonicalUrl ? extractSourceDomain(canonicalUrl) : undefined
  const title = normalizeSourceText(input.title) ?? 'Untitled source'
  const kind =
    input.kind ?? (canonicalUrl ? inferKindFromUrl(canonicalUrl) : 'unknown')

  return {
    id: createSourceId({
      retrievalMethod: input.retrievalMethod,
      canonicalUrl,
      title,
      rank: input.rank
    }),
    kind,
    title,
    url,
    canonicalUrl,
    domain,
    siteName: normalizeSourceText(input.siteName) ?? domain,
    author: normalizeSourceText(input.author),
    publishedAt: normalizeSourceDate(input.publishedAt),
    updatedAt: normalizeSourceDate(input.updatedAt),
    summary: normalizeSourceText(input.summary),
    snippet: normalizeSourceText(input.snippet),
    imageUrl: canonicalizeSourceUrl(input.imageUrl),
    faviconUrl: canonicalizeSourceUrl(input.faviconUrl),
    language: normalizeSourceText(input.language),
    provider: normalizeSourceText(input.provider),
    retrievalMethod: input.retrievalMethod,
    retrievalQuery: normalizeSourceText(input.retrievalQuery),
    rank: input.rank,
    score: input.score,
    sourcePreference: input.sourcePreference,
    entities: input.entities,
    raw: input.raw
  }
}

function normalizeSearchResultItem(
  item: SearchResultItem,
  index: number,
  options: Required<Pick<NormalizeSourceOptions, 'provider'>> &
    NormalizeSourceOptions,
  retrievalMethod: SourceRetrievalMethod
): NormalizedSource {
  return createNormalizedSource({
    kind: item.sourceKind,
    title: item.title,
    url: item.url,
    siteName: item.siteName,
    snippet: item.content,
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
    provider: item.provider ?? options.provider,
    retrievalMethod: item.retrievalMethod ?? retrievalMethod,
    retrievalQuery: options.retrievalQuery,
    rank: index + 1,
    sourcePreference: item.sourcePreference,
    entities: item.entities,
    raw: item
  })
}

export function normalizeSearchResults(
  results: SearchResults,
  options: NormalizeSourceOptions = {}
): NormalizedSource[] {
  return results.results.map((item, index) =>
    normalizeSearchResultItem(
      item,
      index,
      {
        provider: options.provider ?? 'search',
        retrievalQuery: options.retrievalQuery ?? results.query
      },
      'search'
    )
  )
}

export function normalizeFetchResults(
  results: SearchResults,
  options: NormalizeSourceOptions = {}
): NormalizedSource[] {
  return results.results.map((item, index) =>
    normalizeSearchResultItem(
      item,
      index,
      {
        provider: options.provider ?? 'direct-fetch',
        retrievalQuery: options.retrievalQuery ?? results.query
      },
      'fetch'
    )
  )
}

function normalizeFeedItem({
  item,
  feed,
  rank
}: {
  item: FeedItem
  feed: ParsedFeed
  rank: number
}): NormalizedSource {
  const normalized = createNormalizedSource({
    title: item.title,
    url: item.url,
    summary: item.summary ?? item.content,
    author: item.author,
    publishedAt: item.published,
    updatedAt: item.updated,
    imageUrl: item.podcast?.image ?? feed.image,
    provider: 'feed',
    retrievalMethod: 'feed',
    rank,
    raw: {
      feedUrl: feed.url,
      feedFormat: feed.format,
      feedItemId: item.id,
      enclosures: item.enclosures,
      podcast: item.podcast
    }
  })

  return {
    ...normalized,
    kind:
      feed.isPodcast || item.podcast || item.enclosures?.length
        ? 'podcast'
        : 'feed-item',
    siteName: normalizeSourceText(feed.title) ?? normalized.siteName,
    language: normalizeSourceText(feed.language) ?? normalized.language
  }
}

export function normalizeFeedResults(
  results: FeedSearchResults
): NormalizedSource[] {
  if (results.feed) {
    return results.feed.items.map((item, index) =>
      normalizeFeedItem({
        item,
        feed: results.feed!,
        rank: index + 1
      })
    )
  }

  return (results.feeds ?? []).map((feed, index) =>
    createNormalizedSource({
      title: feed.title,
      url: feed.url,
      summary: feed.description,
      imageUrl: feed.favicon,
      provider: feed.source,
      retrievalMethod: 'feed',
      rank: index + 1,
      score: feed.score,
      raw: feed
    })
  )
}

export type { NormalizedSource, SourceKind, SourceRetrievalMethod }
