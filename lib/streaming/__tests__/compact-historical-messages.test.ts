import type { UIMessage } from 'ai'
import { convertToModelMessages } from 'ai'
import { describe, expect, it } from 'vitest'

import { compactHistoricalMessages } from '../helpers/compact-historical-messages'

const createCitedAssistantMessage = (id: number) => ({
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

    const [compacted, sourceContextMessage] =
      compactHistoricalMessages(messages)
    const [answer] = compacted.parts as Array<{
      type: 'text'
      text: string
    }>
    const [sourceContext] = sourceContextMessage.parts as Array<{
      type: 'text'
      text: string
    }>

    expect(answer.text).toContain('(https://example.com/cited)')
    expect(answer.text).not.toContain('#call_1')
    expect(answer.text).not.toContain('<source_context>')
    expect(sourceContextMessage).toMatchObject({
      id: 'assistant-1-source-context',
      role: 'user'
    })
    expect(sourceContext.text).toContain(
      'Source context attached by the application for the preceding answer.'
    )
    expect(sourceContext.text).toContain('<source_context>')
    expect(sourceContext.text).toContain('Cited source')
    expect(sourceContext.text).toContain('https://example.com/cited')
    expect(sourceContext.text).not.toContain('Unused source')
    expect(sourceContext.text).not.toContain('https://example.com/unused')
    expect(sourceContext.text).not.toContain('x'.repeat(401))
  })

  it('keeps a source cited after a malformed-close citation', () => {
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
                  title: 'First source',
                  url: 'https://example.com/first',
                  content: 'First evidence'
                },
                {
                  title: 'Later source',
                  url: 'https://example.com/later',
                  content: 'Later evidence'
                }
              ]
            }
          },
          {
            type: 'text',
            text: 'First [1](#call_1] middle survives. Later [2](#call_1)'
          }
        ]
      }
    ] as unknown as UIMessage[]

    const sourceContext = compactHistoricalMessages(messages)[1].parts[0] as {
      type: 'text'
      text: string
    }

    expect(sourceContext.text).toContain('First source')
    expect(sourceContext.text).toContain('Later source')
    expect(sourceContext.text).toContain('https://example.com/later')
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

    const sourceContext = compactHistoricalMessages(messages)[1].parts[0] as {
      type: 'text'
      text: string
    }

    expect(sourceContext.text).toContain(
      'Evidence stored by the legacy Brave provider.'
    )
  })

  it('adds source context to every cited assistant turn', () => {
    const compacted = compactHistoricalMessages(
      [1, 2, 3].map(createCitedAssistantMessage) as unknown as UIMessage[]
    )

    expect(compacted).toHaveLength(6)
    for (let index = 0; index < 3; index++) {
      const answer = compacted[index * 2]
      const sourceMessage = compacted[index * 2 + 1]
      const sourceContext = sourceMessage.parts[0] as {
        type: 'text'
        text: string
      }

      expect(answer.role).toBe('assistant')
      expect(answer.parts).toHaveLength(1)
      expect(sourceMessage.role).toBe('user')
      expect(sourceContext.text).toContain(`Evidence ${index + 1}`)
    }
  })

  it.each([
    '<source_context>leaked evidence</source_context>',
    '<source_context>truncated leaked evidence'
  ])('removes leaked source context before replaying citations', leaked => {
    const message = createCitedAssistantMessage(1) as unknown as UIMessage
    const textPart = message.parts.find(part => part.type === 'text')
    if (!textPart || textPart.type !== 'text') {
      throw new Error('Expected assistant text part')
    }
    textPart.text = `Answer [1](#call_1)\n\n${leaked}`

    const compacted = compactHistoricalMessages([message])
    const serialized = JSON.stringify(compacted)

    expect(compacted).toHaveLength(2)
    expect(compacted[0].parts[0]).toMatchObject({
      type: 'text',
      text: 'Answer [example](https://example.com/1)'
    })
    expect(serialized.match(/<source_context>/g)).toHaveLength(1)
  })

  it('does not add source context after an uncited assistant turn', () => {
    const message = {
      id: 'assistant-uncited',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Answer without citations.' }]
    } as UIMessage

    expect(compactHistoricalMessages([message])).toEqual([message])
  })

  it('drops an assistant message whose only text is leaked source context', () => {
    const message = {
      id: 'assistant-leaked-only',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: '<source_context>leaked evidence</source_context>'
        }
      ]
    } as UIMessage

    expect(compactHistoricalMessages([message])).toEqual([])
  })

  it('renders a turn identically however many turns follow it', () => {
    // A message that is already in history must never change: the model saw
    // it that way, and the prompt cache matches on the unchanged prefix.
    const turns = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Question 1' }]
      },
      createCitedAssistantMessage(1),
      {
        id: 'user-2',
        role: 'user',
        parts: [{ type: 'text', text: 'Question 2' }]
      },
      createCitedAssistantMessage(2),
      {
        id: 'user-3',
        role: 'user',
        parts: [{ type: 'text', text: 'Question 3' }]
      }
    ] as unknown as UIMessage[]

    const afterTwoTurns = compactHistoricalMessages(turns.slice(0, 3))
    const afterFiveTurns = compactHistoricalMessages(turns)

    expect(JSON.stringify(afterFiveTurns.slice(0, afterTwoTurns.length))).toBe(
      JSON.stringify(afterTwoTurns)
    )
  })

  it('keeps labelled source context independent of earlier messages', () => {
    const labelledTurn = {
      id: 'assistant-labelled',
      role: 'assistant' as const,
      parts: [
        {
          type: 'tool-search',
          toolCallId: 'opaque-call',
          state: 'output-available',
          input: { query: 'labelled' },
          output: {
            query: 'labelled',
            images: [],
            results: [
              {
                label: 'S7',
                title: 'Labelled source',
                url: 'https://labelled.example/source',
                content: 'Persisted labelled evidence'
              }
            ]
          }
        },
        { type: 'text', text: 'Labelled answer. [2](#S7)' }
      ]
    } as unknown as UIMessage
    const earlierTurns = [1, 2, 3].map(
      createCitedAssistantMessage
    ) as unknown as UIMessage[]

    const byItself = compactHistoricalMessages([labelledTurn])
    const afterEarlierTurns = compactHistoricalMessages([
      ...earlierTurns,
      labelledTurn
    ]).slice(-2)
    const answer = byItself[0].parts[0] as { type: 'text'; text: string }
    const sourceContext = byItself[1].parts[0] as {
      type: 'text'
      text: string
    }

    expect(afterEarlierTurns).toEqual(byItself)
    expect(answer.text).toContain('https://labelled.example/source')
    expect(sourceContext.text).toContain('Persisted labelled evidence')
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
    const sourceContext = compacted[1].parts[0] as {
      type: 'text'
      text: string
    }

    // URLs are dropped ahead of evidence when the budget is tight, because
    // processCitations already expanded them into the answer above.
    const answer = compacted[0].parts[0] as { type: 'text'; text: string }
    for (let index = 1; index <= 6; index++) {
      expect(sourceContext.text).toContain(`Evidence ${index}`)
      expect(answer.text).toContain(`https://example.com/${index}`)
    }
    expect(
      sourceContext.text.slice(sourceContext.text.indexOf('<source_context>'))
        .length
    ).toBeLessThanOrEqual(800)
  })

  it('keeps full excerpts and URLs while few sources are cited', () => {
    const results = Array.from({ length: 2 }, (_, index) => ({
      title: `Source ${index + 1}`,
      url: `https://example.com/${index + 1}`,
      content: `Evidence ${index + 1} ${'x'.repeat(120)}`
    }))
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
          { type: 'text', text: '[1](#call_1) [2](#call_1)' }
        ]
      }
    ] as unknown as UIMessage[]

    const sourceContext = compactHistoricalMessages(messages)[1].parts[0] as {
      type: 'text'
      text: string
    }

    for (let index = 1; index <= 2; index++) {
      expect(sourceContext.text).toContain(`Source ${index}`)
      expect(sourceContext.text).toContain(`https://example.com/${index}`)
      expect(sourceContext.text).toContain(
        `Evidence ${index} ${'x'.repeat(80)}`
      )
    }
    expect(
      sourceContext.text.slice(sourceContext.text.indexOf('<source_context>'))
        .length
    ).toBeLessThanOrEqual(800)
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
    const sourceContext = compacted[1].parts[0] as {
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
    expect(
      sourceContext.text.slice(sourceContext.text.indexOf('<source_context>'))
        .length
    ).toBeLessThanOrEqual(800)
  })
})
