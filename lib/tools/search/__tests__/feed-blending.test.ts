import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SearchResults } from '@/lib/types'
import type { ParsedFeed } from '@/lib/types/feed'

import {
  blendConfiguredFeedResults,
  clearFeedRetrievalCache,
  getConfiguredFeedUrls,
  shouldUseFeedRetrieval
} from '../feed-blending'

const baseSearchResults: SearchResults = {
  query: 'latest climate policy news',
  images: [],
  results: [
    {
      title: 'Search result',
      url: 'https://example.com/search-result',
      content: 'A web search result.'
    },
    {
      title: 'Duplicate search result',
      url: 'https://news.example.com/feed-item?utm_source=search',
      content: 'This should win over the duplicate feed item.'
    }
  ],
  number_of_results: 2
}

function makeFeed(overrides: Partial<ParsedFeed> = {}): ParsedFeed {
  return {
    title: 'Example News',
    description: 'News feed',
    url: 'https://news.example.com/rss.xml',
    siteUrl: 'https://news.example.com',
    format: 'rss2',
    isPodcast: false,
    items: [
      {
        id: '1',
        title: 'Feed item',
        url: 'https://news.example.com/feed-item',
        content: 'Feed item content',
        published: '2026-06-05T12:00:00.000Z'
      },
      {
        id: '2',
        title: 'Fresh feed item',
        url: 'https://news.example.com/fresh',
        summary: 'Fresh feed summary',
        published: '2026-06-05T13:00:00.000Z'
      }
    ],
    ...overrides
  }
}

describe('feed-aware search blending', () => {
  beforeEach(() => {
    clearFeedRetrievalCache()
  })

  it('identifies news and latest queries without treating stable definitions as feed-worthy', () => {
    expect(
      shouldUseFeedRetrieval({
        query: 'latest climate policy news',
        contentTypes: ['web']
      })
    ).toBe(true)
    expect(
      shouldUseFeedRetrieval({
        query: 'breaking updates from NASA today',
        contentTypes: ['web']
      })
    ).toBe(true)
    expect(
      shouldUseFeedRetrieval({
        query: 'what is photosynthesis',
        contentTypes: ['web']
      })
    ).toBe(false)
    expect(
      shouldUseFeedRetrieval({
        query: 'city council',
        contentTypes: ['news']
      })
    ).toBe(true)
  })

  it('parses configured feed URLs safely and deduplicates them', () => {
    expect(
      getConfiguredFeedUrls({
        DEFAULT_NEWS_FEEDS:
          ' https://news.example.com/rss.xml, javascript:alert(1), https://news.example.com/rss.xml#frag, https://blog.example.com/feed.json '
      })
    ).toEqual([
      'https://news.example.com/rss.xml',
      'https://blog.example.com/feed.json'
    ])
  })

  it('reads configured feeds, maps items into search results, and deduplicates canonical URLs', async () => {
    const readFeed = vi.fn(async () => makeFeed())

    const blended = await blendConfiguredFeedResults(baseSearchResults, {
      query: 'latest climate policy news',
      contentTypes: ['web'],
      env: {
        ENABLE_FEED_RETRIEVAL: 'true',
        DEFAULT_NEWS_FEEDS: 'https://news.example.com/rss.xml',
        FEED_QUERY_MAX_ITEMS: '10',
        FEED_CACHE_TTL_SECONDS: '900'
      },
      readFeed
    })

    expect(readFeed).toHaveBeenCalledWith(
      'https://news.example.com/rss.xml',
      10
    )
    expect(blended.results).toHaveLength(3)
    expect(blended.results.map(result => result.url)).toEqual([
      'https://example.com/search-result',
      'https://news.example.com/feed-item?utm_source=search',
      'https://news.example.com/fresh'
    ])
    expect(blended.results[2]).toMatchObject({
      title: 'Fresh feed item',
      url: 'https://news.example.com/fresh',
      content: 'Fresh feed summary',
      sourceKind: 'feed-item',
      provider: 'feed',
      retrievalMethod: 'feed',
      publishedAt: '2026-06-05T13:00:00.000Z',
      siteName: 'Example News'
    })
    expect(blended.number_of_results).toBe(3)
  })

  it('caches feed reads within the configured TTL', async () => {
    const readFeed = vi.fn(async () => makeFeed())
    const options = {
      query: 'latest climate policy news',
      contentTypes: ['web'] as const,
      env: {
        ENABLE_FEED_RETRIEVAL: 'true',
        DEFAULT_NEWS_FEEDS: 'https://news.example.com/rss.xml',
        FEED_CACHE_TTL_SECONDS: '900'
      },
      readFeed,
      now: () => 1000
    }

    await blendConfiguredFeedResults(baseSearchResults, options)
    await blendConfiguredFeedResults(baseSearchResults, options)

    expect(readFeed).toHaveBeenCalledTimes(1)
  })

  it('isolates broken feeds instead of failing the whole search', async () => {
    const readFeed = vi
      .fn<(url: string, maxItems: number) => Promise<ParsedFeed>>()
      .mockRejectedValueOnce(new Error('feed down'))
      .mockResolvedValueOnce(
        makeFeed({
          url: 'https://working.example.com/rss.xml',
          items: [
            {
              title: 'Working item',
              url: 'https://working.example.com/item',
              content: 'Working content'
            }
          ]
        })
      )
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    const blended = await blendConfiguredFeedResults(baseSearchResults, {
      query: 'latest climate policy news',
      contentTypes: ['web'],
      env: {
        ENABLE_FEED_RETRIEVAL: 'true',
        DEFAULT_NEWS_FEEDS:
          'https://broken.example.com/rss.xml,https://working.example.com/rss.xml'
      },
      readFeed
    })

    expect(
      blended.results.some(result => result.title === 'Working item')
    ).toBe(true)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[FeedRetrieval] Feed read failed:',
      'https://broken.example.com/rss.xml',
      expect.any(Error)
    )

    consoleWarnSpy.mockRestore()
  })
})
