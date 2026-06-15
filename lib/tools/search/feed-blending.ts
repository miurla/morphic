import { canonicalizeSourceUrl } from '@/lib/sources/source-metadata'
import type { SearchResultItem, SearchResults } from '@/lib/types'
import type { ParsedFeed } from '@/lib/types/feed'

import { parseFeedUrl } from '../feed'

type FeedBlendEnv = Record<string, string | undefined>

type FeedRead = (url: string, maxItems: number) => Promise<ParsedFeed>

interface FeedCacheEntry {
  expiresAt: number
  feed: ParsedFeed
}

export interface FeedRetrievalDecisionInput {
  query: string
  contentTypes?: readonly string[]
}

export interface FeedBlendOptions extends FeedRetrievalDecisionInput {
  env?: FeedBlendEnv
  readFeed?: FeedRead
  now?: () => number
}

const DEFAULT_FEED_QUERY_MAX_ITEMS = 20
const DEFAULT_FEED_CACHE_TTL_SECONDS = 900
const feedCache = new Map<string, FeedCacheEntry>()

const NEWS_QUERY_PATTERNS = [
  /\bnews\b/i,
  /\blatest\b/i,
  /\brecent\b/i,
  /\bupdates?\b/i,
  /\bbreaking\b/i,
  /\bheadlines?\b/i,
  /\btoday\b/i,
  /\bthis\s+(week|month|morning|afternoon|evening)\b/i
]

export function clearFeedRetrievalCache() {
  feedCache.clear()
}

export function shouldUseFeedRetrieval({
  query,
  contentTypes = []
}: FeedRetrievalDecisionInput): boolean {
  if (contentTypes.includes('news')) {
    return true
  }

  return NEWS_QUERY_PATTERNS.some(pattern => pattern.test(query))
}

export function getConfiguredFeedUrls(
  env: FeedBlendEnv = process.env
): string[] {
  const rawFeeds = env.DEFAULT_NEWS_FEEDS
  if (!rawFeeds) {
    return []
  }

  const urls = new Set<string>()
  for (const rawFeed of rawFeeds.split(',')) {
    const canonicalUrl = canonicalizeSourceUrl(rawFeed)
    if (canonicalUrl) {
      urls.add(canonicalUrl)
    }
  }

  return [...urls]
}

function isFeedRetrievalEnabled(env: FeedBlendEnv = process.env): boolean {
  return env.ENABLE_FEED_RETRIEVAL === 'true'
}

function positiveIntegerFromEnv(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.trunc(parsed)
}

function feedItemToSearchResult(
  item: ParsedFeed['items'][number],
  feed: ParsedFeed
) {
  if (!item.url) {
    return null
  }

  return {
    title: item.title,
    url: item.url,
    content: item.summary ?? item.content ?? '',
    sourceKind:
      feed.isPodcast || item.podcast || item.enclosures?.length
        ? 'podcast'
        : 'feed-item',
    provider: 'feed',
    retrievalMethod: 'feed',
    publishedAt: item.published,
    updatedAt: item.updated,
    siteName: feed.title
  } satisfies SearchResultItem
}

async function readCachedFeed({
  url,
  maxItems,
  ttlSeconds,
  readFeed,
  now
}: {
  url: string
  maxItems: number
  ttlSeconds: number
  readFeed: FeedRead
  now: () => number
}): Promise<ParsedFeed> {
  const cacheKey = `${url}:${maxItems}`
  const cached = feedCache.get(cacheKey)
  const currentTime = now()
  if (cached && cached.expiresAt > currentTime) {
    return cached.feed
  }

  const feed = await readFeed(url, maxItems)
  feedCache.set(cacheKey, {
    feed,
    expiresAt: currentTime + ttlSeconds * 1000
  })
  return feed
}

function dedupeSearchResults(results: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<string>()
  const deduped: SearchResultItem[] = []

  for (const result of results) {
    const key = canonicalizeSourceUrl(result.url) ?? result.url
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(result)
  }

  return deduped
}

export async function blendConfiguredFeedResults(
  searchResults: SearchResults,
  {
    query,
    contentTypes = [],
    env = process.env,
    readFeed = parseFeedUrl,
    now = Date.now
  }: FeedBlendOptions
): Promise<SearchResults> {
  if (
    !isFeedRetrievalEnabled(env) ||
    !shouldUseFeedRetrieval({ query, contentTypes })
  ) {
    return searchResults
  }

  const feedUrls = getConfiguredFeedUrls(env)
  if (feedUrls.length === 0) {
    return searchResults
  }

  const maxItems = positiveIntegerFromEnv(
    env.FEED_QUERY_MAX_ITEMS,
    DEFAULT_FEED_QUERY_MAX_ITEMS
  )
  const ttlSeconds = positiveIntegerFromEnv(
    env.FEED_CACHE_TTL_SECONDS,
    DEFAULT_FEED_CACHE_TTL_SECONDS
  )
  const feedResults: SearchResultItem[] = []

  for (const feedUrl of feedUrls) {
    try {
      const feed = await readCachedFeed({
        url: feedUrl,
        maxItems,
        ttlSeconds,
        readFeed,
        now
      })
      for (const item of feed.items) {
        const result = feedItemToSearchResult(item, feed)
        if (result) {
          feedResults.push(result)
        }
      }
    } catch (error) {
      console.warn('[FeedRetrieval] Feed read failed:', feedUrl, error)
    }
  }

  const results = dedupeSearchResults([
    ...searchResults.results,
    ...feedResults
  ])

  return {
    ...searchResults,
    results,
    number_of_results: results.length
  }
}
