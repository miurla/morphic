import { describe, expect, it } from 'vitest'

import {
  normalizeFeedResults,
  normalizeFetchResults,
  normalizeSearchResults
} from '../normalize-source'

describe('source normalization', () => {
  it('normalizes search results with stable canonical URL, domain, rank, and provenance', () => {
    const sources = normalizeSearchResults(
      {
        query: 'source first research',
        images: [],
        results: [
          {
            title: 'Source First AI',
            url: 'HTTPS://Example.com/article/?utm_source=newsletter&b=2&a=1#section',
            content: 'A short search snippet'
          }
        ]
      },
      { provider: 'qwant' }
    )

    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({
      kind: 'web',
      title: 'Source First AI',
      url: 'https://example.com/article?a=1&b=2',
      canonicalUrl: 'https://example.com/article?a=1&b=2',
      domain: 'example.com',
      siteName: 'example.com',
      snippet: 'A short search snippet',
      provider: 'qwant',
      retrievalMethod: 'search',
      retrievalQuery: 'source first research',
      rank: 1
    })
    expect(sources[0].id).toMatch(/^source_search_/)
  })

  it('normalizes feed-blended search results as feed item sources', () => {
    const [source] = normalizeSearchResults({
      query: 'latest local news',
      images: [],
      results: [
        {
          title: 'Feed story',
          url: 'https://news.example.com/story',
          content: 'Feed story summary',
          sourceKind: 'feed-item',
          provider: 'feed',
          retrievalMethod: 'feed',
          publishedAt: '2026-06-05T12:00:00.000Z'
        }
      ]
    })

    expect(source.kind).toBe('feed-item')
    expect(source.provider).toBe('feed')
    expect(source.retrievalMethod).toBe('feed')
    expect(source.publishedAt).toBe('2026-06-05T12:00:00.000Z')
  })

  it('preserves per-result knowledge graph entities', () => {
    const [source] = normalizeSearchResults({
      query: 'Lagos Portugal',
      images: [],
      results: [
        {
          title: 'Lagos guide',
          url: 'https://example.com/lagos',
          content: 'Lagos is in Portugal.',
          entities: [
            {
              label: 'Lagos',
              matchedText: 'Lagos Portugal',
              wikidataId: 'Q209489',
              wikidataUrl: 'https://www.wikidata.org/wiki/Q209489',
              source: 'wikidata',
              confidence: 0.95
            }
          ]
        }
      ]
    })

    expect(source.entities).toEqual([
      expect.objectContaining({
        label: 'Lagos',
        wikidataId: 'Q209489'
      })
    ])
  })

  it('normalizes feed items and preserves podcast/feed metadata', () => {
    const sources = normalizeFeedResults({
      action: 'read',
      url: 'https://pod.example/feed.xml',
      feed: {
        title: 'Example Podcast',
        description: 'Independent audio',
        url: 'https://pod.example/feed.xml',
        siteUrl: 'https://pod.example',
        format: 'rss2',
        image: 'https://pod.example/art.jpg',
        isPodcast: true,
        items: [
          {
            id: 'episode-1',
            title: 'Episode One',
            url: 'https://pod.example/episodes/1?utm_medium=rss',
            summary: 'Episode summary',
            author: 'Damon',
            published: '2026-06-01T12:00:00Z',
            enclosures: [
              {
                url: 'https://cdn.example/audio.mp3',
                type: 'audio/mpeg'
              }
            ],
            podcast: {
              transcripts: [
                {
                  url: 'https://pod.example/transcripts/1.vtt',
                  type: 'text/vtt'
                }
              ]
            }
          }
        ]
      }
    })

    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({
      kind: 'podcast',
      title: 'Episode One',
      url: 'https://pod.example/episodes/1',
      canonicalUrl: 'https://pod.example/episodes/1',
      domain: 'pod.example',
      siteName: 'Example Podcast',
      author: 'Damon',
      publishedAt: '2026-06-01T12:00:00.000Z',
      summary: 'Episode summary',
      imageUrl: 'https://pod.example/art.jpg',
      provider: 'feed',
      retrievalMethod: 'feed',
      rank: 1
    })
    expect(sources[0].raw).toMatchObject({
      feedUrl: 'https://pod.example/feed.xml',
      feedFormat: 'rss2',
      enclosures: [{ url: 'https://cdn.example/audio.mp3' }],
      podcast: {
        transcripts: [{ url: 'https://pod.example/transcripts/1.vtt' }]
      }
    })
  })

  it('normalizes direct fetch results without losing the final URL', () => {
    const sources = normalizeFetchResults({
      query: '',
      images: [],
      results: [
        {
          title: 'Fetched Page',
          url: 'https://docs.example.com/path/',
          content: 'Fetched page text'
        }
      ]
    })

    expect(sources).toEqual([
      expect.objectContaining({
        kind: 'web',
        title: 'Fetched Page',
        url: 'https://docs.example.com/path',
        canonicalUrl: 'https://docs.example.com/path',
        domain: 'docs.example.com',
        retrievalMethod: 'fetch',
        provider: 'direct-fetch',
        snippet: 'Fetched page text'
      })
    ])
  })

  it('handles missing or invalid URLs safely', () => {
    const [missingUrlSource, invalidUrlSource] = normalizeSearchResults(
      {
        query: 'broken source',
        images: [],
        results: [
          {
            title: '',
            url: '',
            content: 'No URL available'
          },
          {
            title: 'Bad URL',
            url: 'not a url',
            content: 'Invalid URL value'
          }
        ]
      },
      { provider: 'test-provider' }
    )

    expect(missingUrlSource).toMatchObject({
      kind: 'unknown',
      title: 'Untitled source',
      retrievalMethod: 'search',
      provider: 'test-provider'
    })
    expect(missingUrlSource.url).toBeUndefined()
    expect(missingUrlSource.domain).toBeUndefined()

    expect(invalidUrlSource).toMatchObject({
      kind: 'unknown',
      title: 'Bad URL',
      url: 'not a url'
    })
    expect(invalidUrlSource.canonicalUrl).toBeUndefined()
  })
})
