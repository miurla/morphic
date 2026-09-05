import { describe, expect, it } from 'vitest'

import type { SearchResultItem } from '@/lib/types'
import type { UIMessage } from '@/lib/types/ai'

import {
  extractCitationMaps,
  extractCitationMapsFromMessages,
  isCitationLabel,
  isDerivedLabel,
  nextCitationLabelNumber,
  processCitations
} from '../citation'

function labelledAssistantMessage({
  id,
  toolCallId,
  labels,
  urls
}: {
  id: string
  toolCallId: string
  labels: string[]
  urls: string[]
}): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [
      {
        type: 'tool-search',
        state: 'output-available',
        toolCallId,
        input: { query: id },
        output: {
          query: id,
          images: [],
          results: labels.map((label, index) => ({
            label,
            title: `${id} source ${index + 1}`,
            url: urls[index],
            content: `${id} evidence ${index + 1}`
          }))
        }
      },
      { type: 'text', text: labels.map(label => `[1](#${label})`).join(' ') }
    ]
  } as unknown as UIMessage
}

describe('processCitations', () => {
  const mockCitationMaps = {
    toolCall1: {
      1: {
        title: 'Google',
        url: 'https://www.google.com',
        content: 'Search engine'
      },
      2: {
        title: 'GitHub',
        url: 'https://docs.github.com',
        content: 'Developer platform'
      },
      3: {
        title: 'Stack Overflow',
        url: 'https://stackoverflow.com/questions/123',
        content: 'Q&A for developers'
      }
    } as Record<number, SearchResultItem>
  }

  it('converts numbered citations to domain names', () => {
    const content = 'Check out [1](#toolCall1) and [2](#toolCall1)'
    const result = processCitations(content, mockCitationMaps)

    expect(result).toBe(
      'Check out [google](https://www.google.com) and [github](https://docs.github.com)'
    )
  })

  it('handles citations with spaces', () => {
    const content = 'See [ 1 ](#toolCall1) for details'
    const result = processCitations(content, mockCitationMaps)

    expect(result).toBe('See [google](https://www.google.com) for details')
  })

  it('handles multiple citations from same domain', () => {
    const citationMaps = {
      toolCall1: {
        1: {
          title: 'Google Search',
          url: 'https://www.google.com/search',
          content: 'Search'
        },
        2: {
          title: 'Google Maps',
          url: 'https://www.google.com/maps',
          content: 'Maps'
        }
      } as Record<number, SearchResultItem>
    }

    const content = 'Try [1](#toolCall1) or [2](#toolCall1)'
    const result = processCitations(content, citationMaps)

    expect(result).toBe(
      'Try [google](https://www.google.com/search) or [google](https://www.google.com/maps)'
    )
  })

  it('converts citations with dotted display labels', () => {
    const citationMaps = {
      toolCall1: {
        1: {
          title: 'Global News',
          url: 'https://topics.global.example.com/portal/news/page.html',
          content: 'News article'
        },
        2: {
          title: 'World Report',
          url: 'https://articles.world.example.net/articles/-/123',
          content: 'News article'
        }
      } as Record<number, SearchResultItem>
    }

    const content = 'Sources [1](#toolCall1) [2](#toolCall1)'
    const result = processCitations(content, citationMaps)

    expect(result).toBe(
      'Sources [global.example](https://topics.global.example.com/portal/news/page.html) [world.example](https://articles.world.example.net/articles/-/123)'
    )
  })

  it('returns empty string for invalid citation numbers', () => {
    const content = 'Invalid [999](#toolCall1) citation'
    const result = processCitations(content, mockCitationMaps)

    expect(result).toBe('Invalid  citation')
  })

  it('returns empty string for missing toolCallId', () => {
    const content = 'Missing [1](#nonExistentTool) tool'
    const result = processCitations(content, mockCitationMaps)

    expect(result).toBe('Missing  tool')
  })

  it('returns empty string for invalid URLs', () => {
    const citationMaps = {
      toolCall1: {
        1: {
          title: 'Invalid',
          url: 'not-a-valid-url',
          content: 'Invalid URL'
        }
      } as Record<number, SearchResultItem>
    }

    const content = 'Check [1](#toolCall1) here'
    const result = processCitations(content, citationMaps)

    expect(result).toBe('Check  here')
  })

  it('resolves citations where the model prepended a toolu_ prefix', () => {
    // Models sometimes cite [1](#toolu_<id>) even though the search tool's
    // call id has no prefix. The cited id should still resolve to the result.
    const content = 'See [1](#toolu_toolCall1) and [2](#toolu_toolCall1)'
    const result = processCitations(content, mockCitationMaps)

    expect(result).toBe(
      'See [google](https://www.google.com) and [github](https://docs.github.com)'
    )
  })

  it.each(['toolu_', 'call_', 'search-'])(
    'normalizes the %s prefix for legacy citations',
    prefix => {
      const result = processCitations(
        `[1](#${prefix}toolCall1)`,
        mockCitationMaps
      )

      expect(result).toBe('[google](https://www.google.com)')
    }
  )

  it('still prefers an exact toolCallId match over a normalized one', () => {
    const content = 'See [1](#toolCall1)'
    const result = processCitations(content, mockCitationMaps)

    expect(result).toBe('See [google](https://www.google.com)')
  })

  it('handles content with no citations', () => {
    const content = 'This is plain text without citations'
    const result = processCitations(content, mockCitationMaps)

    expect(result).toBe('This is plain text without citations')
  })

  it('returns empty string for null/undefined content', () => {
    expect(processCitations('', mockCitationMaps)).toBe('')
    expect(processCitations(null as any, mockCitationMaps)).toBe('')
  })

  it('handles empty citation maps', () => {
    const content = 'Text with [1](#toolCall1) citation'
    const result = processCitations(content, {})

    // When citation maps are empty, content is returned unchanged
    expect(result).toBe('Text with [1](#toolCall1) citation')
  })

  it('encodes URLs to prevent injection', () => {
    const citationMaps = {
      toolCall1: {
        1: {
          title: 'Test',
          url: 'https://example.com/page?param=value&other=test',
          content: 'Test'
        }
      } as Record<number, SearchResultItem>
    }

    const content = 'See [1](#toolCall1)'
    const result = processCitations(content, citationMaps)

    expect(result).toContain('example')
    expect(result).toContain('https://example.com/page?param=value&other=test')
  })

  it('handles complex real-world scenarios', () => {
    const content = `According to [1](#toolCall1), the answer is 42.
    However, [2](#toolCall1) suggests otherwise.
    For more information, see [3](#toolCall1).`

    const result = processCitations(content, mockCitationMaps)

    expect(result).toContain('[google](https://www.google.com)')
    expect(result).toContain('[github](https://docs.github.com)')
    expect(result).toContain(
      '[stackoverflow](https://stackoverflow.com/questions/123)'
    )
  })

  it('handles citation numbers at edge cases', () => {
    const content =
      'Edge cases: [0](#toolCall1) [101](#toolCall1) [-1](#toolCall1)'
    const result = processCitations(content, mockCitationMaps)

    // 0 and 101 are out of bounds (1-100), so they're replaced with empty string
    // -1 doesn't match the regex pattern \d+, so it remains unchanged
    expect(result).toBe('Edge cases:   [-1](#toolCall1)')
  })

  describe('extractCitationMaps', () => {
    const results = [
      { title: 'Google', url: 'https://www.google.com', content: 'a' },
      { title: 'GitHub', url: 'https://docs.github.com', content: 'b' }
    ]

    function messageWithSearchPart(output: unknown): UIMessage {
      return {
        id: 'm1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-search',
            state: 'output-available',
            toolCallId: 'toolCall1',
            output
          }
        ]
      } as unknown as UIMessage
    }

    it('derives the citation map from results when citationMap is absent', () => {
      const maps = extractCitationMaps(
        messageWithSearchPart({ results, images: [], query: 'q' })
      )

      expect(maps.toolCall1[1]).toEqual(results[0])
      expect(maps.toolCall1[2]).toEqual(results[1])
    })

    it('prefers an existing citationMap (older persisted messages)', () => {
      const legacy = {
        1: { title: 'Legacy', url: 'https://legacy.example.com', content: 'c' }
      }
      const maps = extractCitationMaps(
        messageWithSearchPart({ results, citationMap: legacy })
      )

      expect(maps.toolCall1).toBe(legacy)
    })

    it('omits tool calls with no results and no citationMap', () => {
      const maps = extractCitationMaps(
        messageWithSearchPart({ results: [], images: [], query: 'q' })
      )

      expect(maps).toEqual({})
    })

    it('produces a map that processCitations can resolve', () => {
      const maps = extractCitationMaps(
        messageWithSearchPart({ results, images: [], query: 'q' })
      )
      const result = processCitations('See [1](#toolCall1)', maps)

      expect(result).toBe('See [google](https://www.google.com)')
    })

    it('adds one-result maps for valid persisted labels', () => {
      const labelledResults = [
        { ...results[0], label: 'S3' },
        { ...results[1], label: 'invalid' }
      ]
      const maps = extractCitationMaps(
        messageWithSearchPart({ results: labelledResults })
      )

      expect(maps.S3).toEqual({ 1: labelledResults[0] })
      expect(maps).not.toHaveProperty('invalid')
      expect(maps.toolCall1[2]).toEqual(labelledResults[1])
    })
  })

  describe('derived citation labels', () => {
    it('resolves each labelled turn through the combined conversation map', () => {
      const turnOne = labelledAssistantMessage({
        id: 'turn-one',
        toolCallId: 'call_one',
        labels: ['S1', 'S2'],
        urls: ['https://turn-one.test/1', 'https://turn-one.test/2']
      })
      const turnTwo = labelledAssistantMessage({
        id: 'turn-two',
        toolCallId: 'call_two',
        labels: ['S3', 'S4'],
        urls: ['https://turn-two.test/1', 'https://turn-two.test/2']
      })
      const maps = extractCitationMapsFromMessages([turnOne, turnTwo])

      expect(processCitations('[1](#S1) [1](#S2)', maps)).toBe(
        '[turn-one](https://turn-one.test/1) [turn-one](https://turn-one.test/2)'
      )
      expect(processCitations('[1](#S3) [1](#S4)', maps)).toBe(
        '[turn-two](https://turn-two.test/1) [turn-two](https://turn-two.test/2)'
      )
      expect(processCitations('[2](#S1)', maps)).toBe(
        '[turn-one](https://turn-one.test/1)'
      )
    })

    it('keeps the first turn addressable when the next seed follows history', () => {
      const turnOne = labelledAssistantMessage({
        id: 'turn-one',
        toolCallId: 'call_one',
        labels: ['S1', 'S2'],
        urls: ['https://first.test/source', 'https://first.test/other']
      })
      const secondSeed = nextCitationLabelNumber([turnOne])
      const turnTwo = labelledAssistantMessage({
        id: 'turn-two',
        toolCallId: 'call_two',
        labels: [`S${secondSeed}`],
        urls: ['https://second.test/source']
      })
      const maps = extractCitationMapsFromMessages([turnOne, turnTwo])

      expect(secondSeed).toBe(3)
      expect(processCitations('[1](#S1)', maps)).toBe(
        '[first](https://first.test/source)'
      )
    })

    it('starts at one without labels and advances past the largest valid label', () => {
      expect(nextCitationLabelNumber([])).toBe(1)

      const legacyMessage = labelledAssistantMessage({
        id: 'legacy-shaped',
        toolCallId: 'call_legacy',
        labels: ['not-a-derived-label'],
        urls: ['https://example.test/legacy']
      })
      expect(nextCitationLabelNumber([legacyMessage])).toBe(1)

      const message = labelledAssistantMessage({
        id: 'history',
        toolCallId: 'call_history',
        labels: ['S2', 'bad', 'S12', 'S3x'],
        urls: [
          'https://example.test/2',
          'https://example.test/bad',
          'https://example.test/12',
          'https://example.test/3x'
        ]
      })

      expect(nextCitationLabelNumber([message])).toBe(13)
    })

    it('refuses to resolve a label two turns both claim', () => {
      const first = labelledAssistantMessage({
        id: 'concurrent-one',
        toolCallId: 'call_one',
        labels: ['S1', 'S2'],
        urls: ['https://one.test/a', 'https://one.test/b']
      })
      const second = labelledAssistantMessage({
        id: 'concurrent-two',
        toolCallId: 'call_two',
        labels: ['S2'],
        urls: ['https://two.test/a']
      })
      const maps = extractCitationMapsFromMessages([first, second])

      expect(maps).not.toHaveProperty('S2')
      expect(processCitations('[1](#S2)', maps)).toBe('')
      // The unambiguous label in the same conversation still resolves.
      expect(processCitations('[1](#S1)', maps)).toBe(
        '[one](https://one.test/a)'
      )
    })

    it('resolves legacy and labelled turns together', () => {
      const legacy = {
        id: 'legacy',
        role: 'assistant',
        parts: [
          {
            type: 'tool-search',
            state: 'output-available',
            toolCallId: 'call_legacy',
            input: { query: 'legacy' },
            output: {
              results: [
                {
                  title: 'Legacy',
                  url: 'https://legacy.test/source',
                  content: 'Legacy evidence'
                }
              ]
            }
          },
          { type: 'text', text: '[1](#toolu_legacy)' }
        ]
      } as unknown as UIMessage
      const labelled = labelledAssistantMessage({
        id: 'labelled',
        toolCallId: 'search-new',
        labels: ['S1'],
        urls: ['https://labelled.test/source']
      })
      const maps = extractCitationMapsFromMessages([legacy, labelled])

      expect(processCitations('[1](#toolu_legacy) [1](#S1)', maps)).toBe(
        '[legacy](https://legacy.test/source) [labelled](https://labelled.test/source)'
      )
    })

    it('recognizes only derived source labels', () => {
      expect(isDerivedLabel('S1')).toBe(true)
      expect(isDerivedLabel('S12')).toBe(true)
      expect(isDerivedLabel('s1')).toBe(false)
      expect(isDerivedLabel('S')).toBe(false)
      expect(isDerivedLabel('S1x')).toBe(false)
    })
  })

  describe('isCitationLabel', () => {
    it('accepts numeric, simple domain, and dotted domain labels', () => {
      expect(isCitationLabel('1')).toBe(true)
      expect(isCitationLabel('youtube')).toBe(true)
      expect(isCitationLabel('global.example')).toBe(true)
      expect(isCitationLabel('world.example')).toBe(true)
    })

    it('rejects punctuation and whitespace outside the label', () => {
      expect(isCitationLabel('')).toBe(false)
      expect(isCitationLabel('global.example.')).toBe(false)
      expect(isCitationLabel('.global.example')).toBe(false)
      expect(isCitationLabel('global example')).toBe(false)
    })
  })
})
