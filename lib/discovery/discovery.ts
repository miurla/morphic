import { normalizeFeedResults } from '@/lib/sources/normalize-source'
import { canonicalizeSourceUrl } from '@/lib/sources/source-metadata'
import { dedupeNormalizedSources } from '@/lib/sources/source-ranking'
import type { NormalizedSource, SourceKind } from '@/lib/sources/source-types'
import type { ParsedFeed } from '@/lib/types/feed'

import { parseFeedUrl } from '../tools/feed'

type DiscoveryEnv = Record<string, string | undefined>
type FeedRead = (url: string, maxItems: number) => Promise<ParsedFeed>

export interface DiscoveryStoryCluster {
  id: string
  title: string
  summary?: string
  category: string
  storyKey: string
  sourceCount: number
  freshnessScore: number
  sources: NormalizedSource[]
}

export interface DiscoveryPageData {
  generatedAt: string
  sources: NormalizedSource[]
  clusters: DiscoveryStoryCluster[]
  feedErrors: string[]
}

export interface BuildDiscoveryPageDataOptions {
  env?: DiscoveryEnv
  readFeed?: FeedRead
  now?: Date
}

const DEFAULT_MAX_ITEMS_PER_FEED = 8
const MAX_FEEDS = 12
const MAX_CLUSTERS = 12
const STOP_WORDS = new Set([
  'about',
  'after',
  'from',
  'have',
  'into',
  'latest',
  'more',
  'news',
  'over',
  'that',
  'their',
  'this',
  'with',
  'your'
])

export function getDiscoveryFeedUrls(
  env: DiscoveryEnv = process.env
): string[] {
  const rawFeeds = env.DEFAULT_NEWS_FEEDS
  if (!rawFeeds) {
    return []
  }

  const seen = new Set<string>()
  const feedUrls: string[] = []

  for (const rawFeed of rawFeeds.split(',')) {
    const canonicalUrl = canonicalizeSourceUrl(rawFeed)
    if (!canonicalUrl || seen.has(canonicalUrl)) {
      continue
    }

    seen.add(canonicalUrl)
    feedUrls.push(canonicalUrl)
    if (feedUrls.length >= MAX_FEEDS) {
      break
    }
  }

  return feedUrls
}

function getMaxItemsPerFeed(env: DiscoveryEnv) {
  const rawValue = env.FEED_QUERY_MAX_ITEMS
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : NaN
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_ITEMS_PER_FEED
  }

  return Math.min(parsed, 25)
}

function slugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function tokenizeTitle(title: string) {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 4 && !STOP_WORDS.has(token))
}

function storyKey(source: NormalizedSource) {
  const tokens = tokenizeTitle(source.title).slice(0, 4)
  if (tokens.length > 0) {
    return tokens.join('-')
  }

  return slugPart(source.domain || source.title || source.id) || source.id
}

function categoryForSource(source: NormalizedSource): string {
  const kindLabels: Record<SourceKind, string> = {
    academic: 'Research',
    feed: 'Feeds',
    'feed-item': 'Articles',
    forum: 'Communities',
    image: 'Media',
    'map-place': 'Places',
    news: 'News',
    'official-doc': 'Official',
    pdf: 'Documents',
    podcast: 'Podcasts',
    unknown: 'Sources',
    'uploaded-file': 'Files',
    video: 'Video',
    web: 'Articles'
  }

  return kindLabels[source.kind] || 'Sources'
}

function freshnessScore(source: NormalizedSource, now = Date.now()) {
  const timestamp = Date.parse(source.publishedAt || source.updatedAt || '')
  if (Number.isNaN(timestamp)) {
    return 0
  }

  const ageHours = Math.max(0, (now - timestamp) / (1000 * 60 * 60))
  return Math.max(0, Math.round(100 - ageHours / 2))
}

function clusterId(key: string) {
  return `cluster-${slugPart(key) || 'source'}`
}

export function buildStoryClusters(
  sources: NormalizedSource[],
  options: { now?: Date } = {}
): DiscoveryStoryCluster[] {
  const clustersByKey = new Map<string, NormalizedSource[]>()
  const now = options.now?.getTime() ?? Date.now()

  for (const source of dedupeNormalizedSources(sources)) {
    const key = storyKey(source)
    const clusterSources = clustersByKey.get(key) ?? []
    clusterSources.push(source)
    clustersByKey.set(key, clusterSources)
  }

  return Array.from(clustersByKey.entries())
    .map(([key, clusterSources]) => {
      const sortedSources = [...clusterSources].sort(
        (left, right) => freshnessScore(right, now) - freshnessScore(left, now)
      )
      const primarySource = sortedSources[0]

      return {
        id: clusterId(key),
        title: primarySource.title,
        summary: primarySource.summary || primarySource.snippet,
        category: categoryForSource(primarySource),
        storyKey: key,
        sourceCount: sortedSources.length,
        freshnessScore: Math.max(
          ...sortedSources.map(source => freshnessScore(source, now))
        ),
        sources: sortedSources
      }
    })
    .sort((left, right) => {
      if (right.freshnessScore !== left.freshnessScore) {
        return right.freshnessScore - left.freshnessScore
      }
      return right.sourceCount - left.sourceCount
    })
    .slice(0, MAX_CLUSTERS)
}

export async function buildDiscoveryPageData({
  env = process.env,
  readFeed = parseFeedUrl,
  now = new Date()
}: BuildDiscoveryPageDataOptions = {}): Promise<DiscoveryPageData> {
  const feedUrls = getDiscoveryFeedUrls(env)
  const maxItems = getMaxItemsPerFeed(env)
  const feedErrors: string[] = []
  const sources: NormalizedSource[] = []

  for (const feedUrl of feedUrls) {
    try {
      const feed = await readFeed(feedUrl, maxItems)
      sources.push(
        ...normalizeFeedResults({
          action: 'read',
          url: feedUrl,
          state: 'complete',
          feed
        })
      )
    } catch (error) {
      console.warn('[Discovery] Feed read failed:', feedUrl, error)
      feedErrors.push(feedUrl)
    }
  }

  const dedupedSources = dedupeNormalizedSources(sources)

  return {
    generatedAt: now.toISOString(),
    sources: dedupedSources,
    clusters: buildStoryClusters(dedupedSources, { now }),
    feedErrors
  }
}
