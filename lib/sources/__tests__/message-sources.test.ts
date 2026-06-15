import { describe, expect, it } from 'vitest'

import {
  collectEntitiesFromMessageParts,
  collectSourcesFromMessageParts
} from '../message-sources'

describe('message source collection', () => {
  it('collects and deduplicates search, fetch, and feed sources in display order', () => {
    const sources = collectSourcesFromMessageParts([
      {
        type: 'tool-search',
        toolCallId: 'search-1',
        state: 'output-available',
        input: { query: 'source first' },
        output: {
          state: 'complete',
          query: 'source first',
          images: [],
          results: [
            {
              title: 'Search Article',
              url: 'https://example.com/article?utm_source=x',
              content: 'Search snippet'
            },
            {
              title: 'Second Result',
              url: 'https://second.example/post',
              content: 'Second snippet'
            }
          ]
        }
      },
      {
        type: 'tool-fetch',
        toolCallId: 'fetch-1',
        state: 'output-available',
        input: { url: 'https://example.com/article' },
        output: {
          state: 'complete',
          query: '',
          images: [],
          results: [
            {
              title: 'Fetched Duplicate',
              url: 'https://example.com/article',
              content: 'Fetched text'
            }
          ]
        }
      },
      {
        type: 'tool-feedSearch',
        toolCallId: 'feed-1',
        state: 'output-available',
        input: { action: 'read', url: 'https://feed.example/rss.xml' },
        output: {
          state: 'complete',
          action: 'read',
          url: 'https://feed.example/rss.xml',
          feed: {
            title: 'Feed Name',
            url: 'https://feed.example/rss.xml',
            format: 'rss2',
            isPodcast: false,
            items: [
              {
                title: 'Feed Item',
                url: 'https://feed.example/item',
                summary: 'Feed summary'
              }
            ]
          }
        }
      }
    ] as any)

    expect(sources.map(source => source.title)).toEqual([
      'Search Article',
      'Second Result',
      'Feed Item'
    ])
    expect(sources.map(source => source.retrievalMethod)).toEqual([
      'search',
      'search',
      'feed'
    ])
  })

  it('ignores incomplete or errored tool parts', () => {
    expect(
      collectSourcesFromMessageParts([
        {
          type: 'tool-search',
          toolCallId: 'search-1',
          state: 'input-available',
          input: { query: 'still searching' }
        },
        {
          type: 'tool-fetch',
          toolCallId: 'fetch-1',
          state: 'output-error',
          errorText: 'failed',
          input: { url: 'https://example.com' }
        }
      ] as any)
    ).toEqual([])
  })

  it('collects and deduplicates knowledge graph entities from completed tools', () => {
    const entities = collectEntitiesFromMessageParts([
      {
        type: 'tool-search',
        state: 'output-available',
        output: {
          state: 'complete',
          entities: [
            {
              label: 'Lagos',
              matchedText: 'Lagos Portugal',
              wikidataId: 'Q209489',
              source: 'wikidata',
              confidence: 0.95
            },
            {
              label: 'Lagos duplicate',
              matchedText: 'Lagos Portugal',
              wikidataId: 'Q209489',
              source: 'wikidata',
              confidence: 0.8
            }
          ]
        }
      }
    ] as any)

    expect(entities).toHaveLength(1)
    expect(entities[0]).toMatchObject({
      label: 'Lagos',
      wikidataId: 'Q209489'
    })
  })
})
