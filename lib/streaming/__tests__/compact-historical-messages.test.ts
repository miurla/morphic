import type { UIMessage } from 'ai'
import { convertToModelMessages } from 'ai'
import { describe, expect, it } from 'vitest'

import { compactHistoricalMessages } from '../helpers/compact-historical-messages'

describe('compactHistoricalMessages', () => {
  it('keeps user messages unchanged', () => {
    const userMessage = {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Question' }]
    } as UIMessage

    const result = compactHistoricalMessages([userMessage])

    expect(result).toEqual([userMessage])
    expect(result[0]).toBe(userMessage)
  })

  it('keeps assistant text while removing execution details and metadata', () => {
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: 'Internal summary',
            providerMetadata: { openai: { itemId: 'rs_1' } }
          },
          {
            type: 'tool-search',
            toolCallId: 'call_1',
            state: 'output-available',
            input: { query: 'example' },
            output: { results: [] },
            callProviderMetadata: { openai: { itemId: 'fc_1' } }
          },
          { type: 'step-start' },
          {
            type: 'text',
            text: 'Final answer',
            providerMetadata: { openai: { itemId: 'msg_1' } }
          }
        ]
      }
    ] as unknown as UIMessage[]

    expect(compactHistoricalMessages(messages)).toEqual([
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Final answer' }]
      }
    ])
  })

  it('drops assistant messages that contain no visible text', () => {
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          { type: 'reasoning', text: 'Internal summary' },
          {
            type: 'tool-search',
            toolCallId: 'call_1',
            state: 'input-available',
            input: { query: 'example' }
          }
        ]
      }
    ] as unknown as UIMessage[]

    expect(compactHistoricalMessages(messages)).toEqual([])
  })

  it('preserves the order of multiple non-empty assistant text parts', () => {
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'First' },
          { type: 'reasoning', text: 'Internal summary' },
          { type: 'text', text: '   ' },
          { type: 'text', text: 'Second' }
        ]
      }
    ] as unknown as UIMessage[]

    expect(compactHistoricalMessages(messages)[0].parts).toEqual([
      { type: 'text', text: 'First' },
      { type: 'text', text: 'Second' }
    ])
  })

  it('converts compacted history without provider-linked reasoning or tools', async () => {
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: 'Internal summary',
            providerMetadata: { openai: { itemId: 'rs_1' } }
          },
          {
            type: 'tool-search',
            toolCallId: 'call_1',
            state: 'input-available',
            input: { query: 'example' },
            callProviderMetadata: { openai: { itemId: 'fc_1' } }
          },
          { type: 'text', text: 'Final answer' }
        ]
      },
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Follow-up' }]
      }
    ] as unknown as UIMessage[]

    const converted = await convertToModelMessages(
      compactHistoricalMessages(messages)
    )

    expect(converted).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Final answer' }]
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Follow-up' }]
      }
    ])
  })

  it('keeps cited evidence as bounded provider-neutral source context', () => {
    const longExcerpt = `Relevant evidence ${'x'.repeat(500)}`
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-search',
            toolCallId: 'call_1',
            state: 'output-available',
            input: { query: 'example' },
            output: {
              query: 'example',
              images: [],
              results: [
                {
                  title: 'Cited source',
                  url: 'https://example.com/cited',
                  content: longExcerpt
                },
                {
                  title: 'Unused source',
                  url: 'https://example.com/unused',
                  content: 'This source was not cited.'
                }
              ]
            }
          },
          { type: 'text', text: 'Answer [1](#call_1)' }
        ]
      }
    ] as unknown as UIMessage[]

    const [compacted] = compactHistoricalMessages(messages)
    const [answer, sourceContext] = compacted.parts as Array<{
      type: 'text'
      text: string
    }>

    expect(answer.text).toContain('(https://example.com/cited)')
    expect(answer.text).not.toContain('#call_1')
    expect(sourceContext.text).toContain('<source_context>')
    expect(sourceContext.text).toContain('Cited source')
    expect(sourceContext.text).toContain('https://example.com/cited')
    expect(sourceContext.text).not.toContain('Unused source')
    expect(sourceContext.text).not.toContain('https://example.com/unused')
    expect(sourceContext.text).not.toContain('x'.repeat(401))
  })

  it('uses description from persisted Brave results when content is absent', () => {
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-search',
            toolCallId: 'call_1',
            state: 'output-available',
            input: { query: 'example' },
            output: {
              query: 'example',
              images: [],
              results: [
                {
                  title: 'Brave source',
                  url: 'https://example.com/brave',
                  description: 'Evidence stored by the legacy Brave provider.'
                }
              ]
            }
          },
          { type: 'text', text: 'Answer [1](#call_1)' }
        ]
      }
    ] as unknown as UIMessage[]

    const sourceContext = compactHistoricalMessages(messages)[0].parts[1] as {
      type: 'text'
      text: string
    }

    expect(sourceContext.text).toContain(
      'Evidence stored by the legacy Brave provider.'
    )
  })

  it('adds source context to only the two most recent assistant turns', () => {
    const createAssistantMessage = (id: number) => ({
      id: `assistant-${id}`,
      role: 'assistant' as const,
      parts: [
        {
          type: 'tool-search',
          toolCallId: `call_${id}`,
          state: 'output-available',
          input: { query: `query ${id}` },
          output: {
            query: `query ${id}`,
            images: [],
            results: [
              {
                title: `Source ${id}`,
                url: `https://example.com/${id}`,
                content: `Evidence ${id}`
              }
            ]
          }
        },
        { type: 'text', text: `Answer ${id} [1](#call_${id})` }
      ]
    })

    const compacted = compactHistoricalMessages(
      [1, 2, 3].map(createAssistantMessage) as unknown as UIMessage[]
    )

    expect(compacted[0].parts).toHaveLength(1)
    expect(compacted[1].parts).toHaveLength(2)
    expect(compacted[2].parts).toHaveLength(2)
  })

  it('keeps all unique cited sources within the source context budget', () => {
    const results = Array.from({ length: 6 }, (_, index) => ({
      title: `Source ${index + 1}`,
      url: `https://example.com/${index + 1}`,
      content: `Evidence ${index + 1} ${'x'.repeat(2000)}`
    }))
    const citations = results
      .map((_, index) => `[${index + 1}](#call_1)`)
      .join(' ')
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-search',
            toolCallId: 'call_1',
            state: 'output-available',
            input: { query: 'example' },
            output: { query: 'example', images: [], results }
          },
          { type: 'text', text: citations }
        ]
      }
    ] as unknown as UIMessage[]

    const compacted = compactHistoricalMessages(messages)
    const sourceContext = compacted[0].parts[1] as {
      type: 'text'
      text: string
    }

    for (let index = 1; index <= 6; index++) {
      expect(sourceContext.text).toContain(`Source ${index}`)
      expect(sourceContext.text).toContain(`https://example.com/${index}`)
    }
    expect(sourceContext.text.length).toBeLessThanOrEqual(4000)
  })

  it('strictly bounds source context when base URLs exceed the budget', () => {
    const results = Array.from({ length: 20 }, (_, index) => ({
      title: `Source ${index + 1} ${'t'.repeat(200)}`,
      url: `https://example.com/${index + 1}?payload=${'u'.repeat(500)}`,
      content: `Evidence ${index + 1} marker ${'x'.repeat(500)}`
    }))
    const citations = results
      .map((_, index) => `[${index + 1}](#call_1)`)
      .join(' ')
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-search',
            toolCallId: 'call_1',
            state: 'output-available',
            input: { query: 'example' },
            output: { query: 'example', images: [], results }
          },
          { type: 'text', text: citations }
        ]
      }
    ] as unknown as UIMessage[]

    const compacted = compactHistoricalMessages(messages)
    const answer = compacted[0].parts[0] as { type: 'text'; text: string }
    const sourceContext = compacted[0].parts[1] as {
      type: 'text'
      text: string
    }

    for (let index = 1; index <= 20; index++) {
      expect(answer.text).toContain(`https://example.com/${index}?payload=`)
      expect(sourceContext.text).toContain(`Evidence ${index} marker`)
    }
    expect(sourceContext.text).toContain(
      'Their URLs remain in the preceding answer.'
    )
    expect(sourceContext.text.length).toBeLessThanOrEqual(4000)
  })
})
