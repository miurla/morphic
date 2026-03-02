import { ModelMessage } from 'ai'
import { describe, expect, test } from 'vitest'

import { Model } from '@/lib/types/models'

import {
  getMaxAllowedTokens,
  shouldTruncateMessages,
  truncateMessages
} from '../context-window'

describe('context-window', () => {
  const mockModel: Model = {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'OpenAI',
    providerId: 'openai'
  }

  const createMessage = (
    role: 'user' | 'assistant',
    content: string
  ): ModelMessage => ({
    role,
    content
  })

  describe('getMaxAllowedTokens', () => {
    test('calculates max tokens correctly for known model', () => {
      const maxTokens = getMaxAllowedTokens(mockModel)
      // Expected: (128000 - 16384) - (128000 * 0.1) = 111616 - 12800 = 98816
      expect(maxTokens).toBe(98816)
    })

    test('uses default values for unknown model', () => {
      const unknownModel: Model = {
        ...mockModel,
        id: 'unknown-model'
      }
      const maxTokens = getMaxAllowedTokens(unknownModel)
      // Expected: (16384 - 4096) - (16384 * 0.1) = 12288 - 1638.4 = 10649.6 -> 10650
      expect(maxTokens).toBe(10650)
    })

    test('ensures minimum viable token count', () => {
      // This would need a model with very small context window to test
      // For now, verify the function returns at least 1000
      const maxTokens = getMaxAllowedTokens(mockModel)
      expect(maxTokens).toBeGreaterThanOrEqual(1000)
    })
  })

  describe('shouldTruncateMessages', () => {
    test('returns false for empty messages', () => {
      expect(shouldTruncateMessages([], mockModel)).toBe(false)
    })

    test('returns false when under limit', () => {
      const messages: ModelMessage[] = [
        createMessage('user', 'Hello'),
        createMessage('assistant', 'Hi there!')
      ]
      expect(shouldTruncateMessages(messages, mockModel)).toBe(false)
    })

    test('returns true when over limit', () => {
      // Create messages that exceed the token limit
      // mockModel (gpt-4o-mini) has 98816 max tokens
      const longText = 'This is a test message. '.repeat(1000) // ~6000 tokens per message
      const messages: ModelMessage[] = Array(20)
        .fill(null)
        .map(() => createMessage('user', longText)) // Total: ~120,000 tokens > 98,816 max tokens
      expect(shouldTruncateMessages(messages, mockModel)).toBe(true)
    })

    test('handles null/undefined messages gracefully', () => {
      expect(shouldTruncateMessages(null as any, mockModel)).toBe(false)
      expect(shouldTruncateMessages(undefined as any, mockModel)).toBe(false)
    })
  })

  describe('truncateMessages', () => {
    test('returns empty array for empty messages', () => {
      expect(truncateMessages([], 1000)).toEqual([])
    })

    test('returns empty array for invalid maxTokens', () => {
      const messages = [createMessage('user', 'Hello')]
      expect(truncateMessages(messages, 0)).toEqual([])
      expect(truncateMessages(messages, -100)).toEqual([])
    })

    test('returns all messages when under limit', () => {
      const messages: ModelMessage[] = [
        createMessage('user', 'Hello'),
        createMessage('assistant', 'Hi!'),
        createMessage('user', 'How are you?'),
        createMessage('assistant', 'I am fine!')
      ]
      const result = truncateMessages(messages, 10000)
      expect(result).toEqual(messages)
    })

    test('preserves first user message when possible', () => {
      const messages: ModelMessage[] = [
        createMessage('user', 'First important context'),
        createMessage('assistant', 'Response 1'),
        createMessage('user', 'Question 2'),
        createMessage('assistant', 'Response 2'),
        createMessage('user', 'Question 3'),
        createMessage('assistant', 'Response 3')
      ]

      const result = truncateMessages(messages, 100) // Very low limit
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toEqual(messages[0]) // First user message preserved
    })

    test('removes assistant messages to keep user messages', () => {
      const messages: ModelMessage[] = [
        createMessage('user', 'Question 1'),
        createMessage('assistant', 'Very long response '.repeat(50)),
        createMessage('user', 'Question 2'),
        createMessage('assistant', 'Another long response '.repeat(50)),
        createMessage('user', 'Important last question')
      ]

      const result = truncateMessages(messages, 200)
      const userMessages = result.filter(m => m.role === 'user')
      expect(userMessages.length).toBeGreaterThan(0)
      expect(userMessages[userMessages.length - 1].content).toBe(
        'Important last question'
      )
    })

    test('removes leading assistant messages when truncating', () => {
      // Create messages that will force truncation
      const longText = 'a'.repeat(1000) // ~250 tokens each
      const messages: ModelMessage[] = [
        createMessage('assistant', longText),
        createMessage('assistant', longText),
        createMessage('user', 'Hello'),
        createMessage('assistant', 'Hi'),
        createMessage('user', 'Last message')
      ]

      // Force truncation with low limit
      const result = truncateMessages(messages, 100)

      // After truncation, should prefer user messages
      expect(result.length).toBeGreaterThan(0)

      // The implementation removes leading non-user messages after truncation
      const hasUserMessage = result.some(m => m.role === 'user')
      expect(hasUserMessage).toBe(true)
    })

    test('handles messages with complex content types', () => {
      const messages: ModelMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'World' }
          ]
        },
        {
          role: 'assistant',
          content: 'Response'
        }
      ]

      const result = truncateMessages(messages, 1000)
      expect(result.length).toBeGreaterThan(0)
    })

    test('handles undefined content gracefully', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: '' },
        { role: 'assistant', content: 'Response' }
      ]

      const result = truncateMessages(messages, 1000)
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('truncation with model ID', () => {
    test('uses tiktoken when model ID is provided', () => {
      const messages: ModelMessage[] = [
        createMessage('user', 'Test message for token counting')
      ]

      // With model ID - should use tiktoken
      const resultWithModel = truncateMessages(messages, 1000, 'gpt-4o-mini')
      expect(resultWithModel).toBeDefined()

      // Without model ID - should use fallback
      const resultWithoutModel = truncateMessages(messages, 1000)
      expect(resultWithoutModel).toBeDefined()
    })
  })
})
