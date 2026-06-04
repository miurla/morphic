import { afterEach, describe, expect, test, vi } from 'vitest'

import { parseFeedUrl } from '../feed'

const originalFetch = globalThis.fetch

function mockFetch(body: string, contentType: string) {
  globalThis.fetch = vi.fn(async () => {
    return new Response(body, {
      headers: {
        'content-type': contentType
      }
    })
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('parseFeedUrl', () => {
  test('parses RSS feeds with Podcasting 2.0 metadata', async () => {
    mockFetch(
      `<?xml version="1.0"?>
      <rss version="2.0"
        xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
        xmlns:podcast="https://podcastindex.org/namespace/1.0">
        <channel>
          <title>Example Podcast</title>
          <description>A show about feeds</description>
          <link>https://example.com</link>
          <podcast:guid>podcast-guid-123</podcast:guid>
          <podcast:locked owner="owner@example.com">yes</podcast:locked>
          <podcast:funding url="https://example.com/support">Support us</podcast:funding>
          <podcast:value type="lightning" method="keysend" suggested="0.00000005000">
            <podcast:valueRecipient name="Host" type="node" address="abc" split="100" />
          </podcast:value>
          <item>
            <title>Episode 1</title>
            <guid>episode-1</guid>
            <pubDate>Sun, 31 May 2026 10:00:00 GMT</pubDate>
            <enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="123" />
            <podcast:transcript url="https://example.com/ep1.json" type="application/json" />
            <podcast:chapters url="https://example.com/chapters.json" type="application/json" />
            <itunes:season>2</itunes:season>
            <itunes:episode>7</itunes:episode>
          </item>
        </channel>
      </rss>`,
      'application/rss+xml'
    )

    const feed = await parseFeedUrl('https://example.com/feed.xml', 10)

    expect(feed.format).toBe('rss2')
    expect(feed.isPodcast).toBe(true)
    expect(feed.podcast?.guid).toBe('podcast-guid-123')
    expect(feed.podcast?.locked?.value).toBe(true)
    expect(feed.podcast?.value?.recipients[0].split).toBe(100)
    expect(feed.items[0].podcast?.transcripts?.[0].url).toBe(
      'https://example.com/ep1.json'
    )
    expect(feed.items[0].podcast?.chapters?.url).toBe(
      'https://example.com/chapters.json'
    )
  })

  test('parses Atom feeds', async () => {
    mockFetch(
      `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Blog</title>
        <link href="https://example.com/" rel="alternate" />
        <entry>
          <title>Atom Post</title>
          <id>tag:example.com,2026:1</id>
          <link href="https://example.com/atom-post" rel="alternate" />
          <updated>2026-05-31T10:00:00Z</updated>
          <summary>Hello from Atom</summary>
        </entry>
      </feed>`,
      'application/atom+xml'
    )

    const feed = await parseFeedUrl('https://example.com/atom.xml', 10)

    expect(feed.format).toBe('atom')
    expect(feed.items[0].title).toBe('Atom Post')
    expect(feed.items[0].url).toBe('https://example.com/atom-post')
  })

  test('parses JSON Feed', async () => {
    mockFetch(
      JSON.stringify({
        version: 'https://jsonfeed.org/version/1.1',
        title: 'JSON Feed',
        home_page_url: 'https://example.com',
        items: [
          {
            id: '1',
            title: 'JSON item',
            url: 'https://example.com/json-item',
            content_text: 'Hello from JSON Feed'
          }
        ]
      }),
      'application/feed+json'
    )

    const feed = await parseFeedUrl('https://example.com/feed.json', 10)

    expect(feed.format).toBe('json')
    expect(feed.items[0].title).toBe('JSON item')
  })

  test('parses RDF/RSS 1.0 feeds', async () => {
    mockFetch(
      `<?xml version="1.0"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
        <channel>
          <title>RDF Feed</title>
          <link>https://example.com</link>
          <description>RDF description</description>
        </channel>
        <item>
          <title>RDF Item</title>
          <link>https://example.com/rdf-item</link>
          <description>Hello from RDF</description>
        </item>
      </rdf:RDF>`,
      'application/rdf+xml'
    )

    const feed = await parseFeedUrl('https://example.com/rss1.xml', 10)

    expect(feed.format).toBe('rss1')
    expect(feed.items[0].title).toBe('RDF Item')
  })
})
