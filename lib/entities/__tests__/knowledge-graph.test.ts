import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  enrichSearchResultsWithKnowledgeGraph,
  lookupKnowledgeGraphEntities
} from '../knowledge-graph'

describe('knowledge graph entity enrichment', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('looks up and merges Wikidata and DBpedia entities for a search query', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('https://www.wikidata.org/w/api.php')) {
        return {
          ok: true,
          json: async () => ({
            search: [
              {
                id: 'Q209489',
                label: 'Lagos',
                description: 'municipality in Portugal',
                score: 0.95
              }
            ]
          })
        }
      }

      if (url.startsWith('https://lookup.dbpedia.org/api/search')) {
        return {
          ok: true,
          json: async () => ({
            docs: [
              {
                label: ['Lagos'],
                resource: ['http://dbpedia.org/resource/Lagos,_Portugal'],
                comment: ['Municipality in Portugal'],
                score: ['0.8']
              }
            ]
          })
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const entities = await lookupKnowledgeGraphEntities(
      'Tell me about Lagos Portugal'
    )

    expect(entities[0]).toMatchObject({
      label: 'Lagos',
      matchedText: 'Lagos Portugal',
      wikidataId: 'Q209489',
      dbpediaUri: 'http://dbpedia.org/resource/Lagos,_Portugal',
      source: 'both'
    })
  })

  it('preserves search results when entity lookup fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network unavailable'))
    )

    const searchResult = {
      query: 'Lagos Portugal',
      images: [],
      results: [
        {
          title: 'Lagos guide',
          url: 'https://example.com/lagos',
          content: 'A guide to Lagos.'
        }
      ]
    }

    await expect(
      enrichSearchResultsWithKnowledgeGraph(searchResult)
    ).resolves.toEqual(searchResult)
  })
})
