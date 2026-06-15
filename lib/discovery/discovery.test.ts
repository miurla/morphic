import { describe, expect, test, vi } from 'vitest'

import type { ParsedFeed } from '@/lib/types/feed'

import {
  buildDiscoveryPageData,
  buildStoryClusters,
  getDiscoveryFeedUrls
} from './discovery'

function feed(overrides: Partial<ParsedFeed> = {}): ParsedFeed {
  return {
    title: 'Example Feed',
    url: 'https://news.example.com/rss.xml',
    siteUrl: 'https://news.example.com',
    format: 'rss2',
    isPodcast: false,
    items: [
      {
        title: 'Launch update from Morphic',
        url: 'https://news.example.com/morphic-launch?utm_source=rss',
        summary: 'A concise update about Morphic launch work.',
        published: '2026-06-05T12:00:00.000Z'
      },
      {
        title: 'Launch update from Morphic duplicate',
        url: 'https://news.example.com/morphic-launch',
        summary: 'Duplicate URL should collapse.',
        published: '2026-06-05T12:10:00.000Z'
      },
      {
        title: 'Podcast episode on open search',
        url: 'https://pod.example.com/episodes/open-search',
        summary: 'A podcast episode about open search systems.',
        published: '2026-06-04T12:00:00.000Z',
        enclosures: [
          {
            url: 'https://pod.example.com/audio/open-search.mp3',
            type: 'audio/mpeg'
          }
        ]
      }
    ],
    ...overrides
  }
}

describe('Discovery data', () => {
  test('parses configured feed URLs safely and deduplicates them', () => {
    expect(
      getDiscoveryFeedUrls({
        DEFAULT_NEWS_FEEDS:
          ' https://news.example.com/rss.xml, javascript:alert(1), https://news.example.com/rss.xml#section, https://blog.example.com/feed.json '
      })
    ).toEqual([
      'https://news.example.com/rss.xml',
      'https://blog.example.com/feed.json'
    ])
  })

  test('isolates feed failures and deduplicates story source URLs', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const readFeed = vi
      .fn<(url: string, maxItems: number) => Promise<ParsedFeed>>()
      .mockRejectedValueOnce(new Error('feed down'))
      .mockResolvedValueOnce(feed())

    const data = await buildDiscoveryPageData({
      env: {
        DEFAULT_NEWS_FEEDS:
          'https://broken.example.com/rss.xml,https://news.example.com/rss.xml',
        FEED_QUERY_MAX_ITEMS: '6'
      },
      readFeed
    })

    expect(readFeed).toHaveBeenCalledTimes(2)
    expect(warnSpy).toHaveBeenCalledWith(
      '[Discovery] Feed read failed:',
      'https://broken.example.com/rss.xml',
      expect.any(Error)
    )
    expect(data.feedErrors).toEqual(['https://broken.example.com/rss.xml'])
    expect(data.sources.map(source => source.canonicalUrl)).toContain(
      'https://news.example.com/morphic-launch'
    )
    expect(data.sources).toHaveLength(2)
    expect(data.clusters).toHaveLength(2)
    warnSpy.mockRestore()
  })

  test('builds ranked clusters from fresh and diverse feed sources', () => {
    // Use a controlled `now` so freshness scores are always meaningful
    // regardless of when the test runs. Items are 2h and 4d old, respectively.
    const now = new Date('2026-06-05T14:00:00.000Z')

    const data = buildStoryClusters(
      [
        {
          id: 'source-1',
          kind: 'feed-item',
          title: 'Fresh item',
          url: 'https://a.example.com/story',
          canonicalUrl: 'https://a.example.com/story',
          domain: 'a.example.com',
          summary: 'Fresh item summary.',
          publishedAt: '2026-06-05T12:00:00.000Z',
          retrievalMethod: 'feed',
          provider: 'feed'
        },
        {
          id: 'source-2',
          kind: 'feed-item',
          title: 'Older item',
          url: 'https://b.example.com/story',
          canonicalUrl: 'https://b.example.com/story',
          domain: 'b.example.com',
          summary: 'Older item summary.',
          publishedAt: '2026-06-01T12:00:00.000Z',
          retrievalMethod: 'feed',
          provider: 'feed'
        }
      ],
      { now }
    )

    expect(data[0]).toMatchObject({
      title: 'Fresh item',
      category: 'Articles',
      sourceCount: 1
    })
    expect(data[0].freshnessScore).toBeGreaterThan(data[1].freshnessScore)
  })
})
