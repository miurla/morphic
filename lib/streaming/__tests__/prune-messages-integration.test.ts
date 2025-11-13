import type { ModelMessage } from 'ai'
import { pruneMessages } from 'ai'
import { describe, expect, it } from 'vitest'

describe('pruneMessages integration', () => {
  it('should prune messages according to configuration', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: 'First question'
      },
      {
        role: 'assistant',
        content: 'Let me think about that...'
      },
      {
        role: 'user',
        content: 'Second question'
      },
      {
        role: 'assistant',
        content: 'Here is my response'
      }
    ]

    const pruned = pruneMessages({
      messages,
      reasoning: 'before-last-message',
      toolCalls: 'before-last-2-messages',
      emptyMessages: 'remove'
    })

    // Should return pruned messages
    expect(Array.isArray(pruned)).toBe(true)
    expect(pruned.length).toBeGreaterThan(0)
    expect(pruned.length).toBeLessThanOrEqual(messages.length)
  })

  it('should handle messages with text content', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: 'Question'
      },
      {
        role: 'assistant',
        content: 'Answer'
      },
      {
        role: 'user',
        content: 'Another question'
      }
    ]

    const pruned = pruneMessages({
      messages,
      reasoning: 'all',
      toolCalls: 'all',
      emptyMessages: 'remove'
    })

    // Should keep all messages with text content
    expect(pruned.length).toBe(messages.length)
    expect(pruned.every((msg: ModelMessage) => msg.content)).toBe(true)
  })

  it('should preserve message structure', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: 'Question 1'
      },
      {
        role: 'assistant',
        content: 'Answer to question 1'
      },
      {
        role: 'user',
        content: 'Question 2'
      },
      {
        role: 'assistant',
        content: 'Answer to question 2'
      }
    ]

    const pruned = pruneMessages({
      messages,
      reasoning: 'before-last-message',
      toolCalls: 'none',
      emptyMessages: 'remove'
    })

    // Last assistant message should be preserved
    const lastAssistant = pruned
      .slice()
      .reverse()
      .find((msg: ModelMessage) => msg.role === 'assistant')
    expect(lastAssistant).toBeDefined()
    expect(lastAssistant!.content).toBeTruthy()
  })

  it('should handle simple conversation messages', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: 'Hello'
      },
      {
        role: 'assistant',
        content: 'Hi there!'
      },
      {
        role: 'user',
        content: 'How are you?'
      },
      {
        role: 'assistant',
        content: 'I am doing well, thank you!'
      }
    ]

    const pruned = pruneMessages({
      messages,
      reasoning: 'before-last-message',
      toolCalls: 'before-last-2-messages',
      emptyMessages: 'remove'
    })

    // Should preserve conversation flow
    expect(pruned.length).toBeGreaterThan(0)
    expect(pruned.every(msg => msg.content)).toBe(true)
  })
})
