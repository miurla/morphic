import type { ModelMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import { convertMessagesForAnthropic } from '../anthropic-message-conversion'

describe('convertMessagesForAnthropic', () => {
  it('should handle messages without tool-calls', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }]
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi there!' }]
      }
    ]

    const result = convertMessagesForAnthropic(messages)
    expect(result).toEqual(messages)
  })

  it('should split assistant message with text after tool-call', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Search for something' }]
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me search for that.' },
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'search',
            input: { query: 'search query' }
          },
          { type: 'text', text: 'Based on the results...' }
        ]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_123',
            toolName: 'search',
            output: { type: 'json', value: { data: 'results' } }
          }
        ]
      }
    ]

    const result = convertMessagesForAnthropic(messages)

    expect(result).toHaveLength(4)
    expect(result[0]).toEqual(messages[0]) // User message unchanged
    expect(result[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me search for that.' },
        {
          type: 'tool-call',
          toolCallId: 'call_123',
          toolName: 'search',
          input: { query: 'search query' }
        }
      ]
    })
    expect(result[2]).toEqual(messages[2]) // Tool result
    expect(result[3]).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'Based on the results...' }]
    })
  })

  it('should handle tool-call at the end of message (no text after)', () => {
    const messages: ModelMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me search.' },
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'search',
            input: { query: 'search query' }
          }
        ]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_123',
            toolName: 'search',
            output: { type: 'json', value: { data: 'results' } }
          }
        ]
      }
    ]

    const result = convertMessagesForAnthropic(messages)
    expect(result).toEqual(messages) // No changes needed
  })

  it('should handle multiple tool-calls in a single message', () => {
    const messages: ModelMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me search and fetch.' },
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'search',
            input: { query: 'search query' }
          },
          {
            type: 'tool-call',
            toolCallId: 'call_456',
            toolName: 'fetch',
            input: { url: 'https://example.com' }
          },
          { type: 'text', text: 'Here are the results...' }
        ]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_123',
            toolName: 'search',
            output: { type: 'json', value: { data: 'search results' } }
          }
        ]
      }
    ]

    const result = convertMessagesForAnthropic(messages)

    // Should split at the first tool-call
    expect(result).toHaveLength(3)
    expect(result[0].content).toHaveLength(3) // text + 2 tool-calls
    expect(result[2]).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'Here are the results...' }]
    })
  })

  it('should handle messages with only tool-calls (no text)', () => {
    const messages: ModelMessage[] = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'search',
            input: { query: 'search query' }
          }
        ]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_123',
            toolName: 'search',
            output: { type: 'json', value: { data: 'results' } }
          }
        ]
      }
    ]

    const result = convertMessagesForAnthropic(messages)
    expect(result).toEqual(messages) // No changes needed
  })

  it('should handle non-assistant messages', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_123',
            toolName: 'search',
            output: { type: 'json', value: { data: 'results' } }
          }
        ]
      }
    ]

    const result = convertMessagesForAnthropic(messages)
    expect(result).toEqual(messages) // No changes to non-assistant messages
  })

  it('should handle empty content arrays', () => {
    const messages: ModelMessage[] = [
      {
        role: 'assistant',
        content: []
      }
    ]

    const result = convertMessagesForAnthropic(messages)
    expect(result).toEqual(messages)
  })

  it('should handle missing tool-result message gracefully', () => {
    const messages: ModelMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me search.' },
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'search',
            input: { query: 'search query' }
          },
          { type: 'text', text: 'Based on the results...' }
        ]
      },
      {
        role: 'user', // Not a tool message
        content: [{ type: 'text', text: 'What did you find?' }]
      }
    ]

    const result = convertMessagesForAnthropic(messages)

    // Should still split but won't include the tool message after splitting
    expect(result).toHaveLength(3)
    expect(result[0].content).toHaveLength(2) // text + tool-call
    expect(result[1]).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'Based on the results...' }]
    })
    expect(result[2]).toEqual(messages[1]) // User message comes after
  })

  it('should handle whitespace-only text after tool-call', () => {
    const messages: ModelMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Searching...' },
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'search',
            input: { query: 'search query' }
          },
          { type: 'text', text: '   \n\t   ' } // Only whitespace
        ]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_123',
            toolName: 'search',
            output: { type: 'json', value: { data: 'results' } }
          }
        ]
      }
    ]

    const result = convertMessagesForAnthropic(messages)

    // Should not split because text after tool-call is whitespace only
    expect(result).toEqual(messages)
  })

  it('should handle string content (not array)', () => {
    const messages: ModelMessage[] = [
      {
        role: 'assistant',
        content: 'This is a simple string message'
      }
    ]

    const result = convertMessagesForAnthropic(messages)
    expect(result).toEqual(messages)
  })
})
