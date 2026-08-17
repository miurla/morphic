import type { ModelMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  appendRelatedQuestionsReminder,
  RELATED_QUESTIONS_REMINDER
} from '../related-questions-reminder'

describe('appendRelatedQuestionsReminder', () => {
  it('places the reminder in its own message after a deep conversation', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Follow-up question' }
    ]
    const originalMessages = structuredClone(messages)

    const result = appendRelatedQuestionsReminder(messages)

    expect(result).not.toBe(messages)
    expect(result.at(-1)).toEqual({
      role: 'user',
      content: [{ type: 'text', text: RELATED_QUESTIONS_REMINDER }]
    })
    expect(result.at(-2)).toEqual(messages.at(-1))
    expect(result.at(-2)).toBe(messages.at(-1))
    expect(messages).toEqual(originalMessages)
  })

  it('leaves a user message carrying non-text parts untouched', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this file' },
          {
            type: 'file',
            data: new Uint8Array([1, 2, 3]),
            mediaType: 'application/pdf'
          }
        ]
      }
    ]
    const originalMessage = messages[0]
    const originalContent = originalMessage.content

    const result = appendRelatedQuestionsReminder(messages)

    expect(result[0]).toEqual(originalMessage)
    expect(result[0]).toBe(originalMessage)
    expect(result[1]).toEqual({
      role: 'user',
      content: [{ type: 'text', text: RELATED_QUESTIONS_REMINDER }]
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toBe(originalMessage)
    expect(messages[0].content).toBe(originalContent)
    expect(messages[0].content).toEqual([
      { type: 'text', text: 'Describe this file' },
      {
        type: 'file',
        data: new Uint8Array([1, 2, 3]),
        mediaType: 'application/pdf'
      }
    ])
  })

  it('leaves messages unchanged when there is no user message', () => {
    const messages: ModelMessage[] = [
      { role: 'assistant', content: 'Existing answer' }
    ]

    expect(appendRelatedQuestionsReminder(messages)).toBe(messages)
  })

  it('keeps replayed conversation history stable across turns', () => {
    const turnNMessages: ModelMessage[] = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Second question' }
    ]
    const turnNPlusOneMessages: ModelMessage[] = [
      ...turnNMessages,
      { role: 'assistant', content: 'Second answer' },
      { role: 'user', content: 'Third question' }
    ]

    const turnNResult = appendRelatedQuestionsReminder(turnNMessages)
    const turnNPlusOneResult =
      appendRelatedQuestionsReminder(turnNPlusOneMessages)

    expect(turnNResult.slice(0, turnNMessages.length)).toEqual(turnNMessages)
    expect(turnNPlusOneResult.slice(0, turnNMessages.length)).toEqual(
      turnNMessages
    )
    expect(turnNPlusOneResult[turnNMessages.length]).toEqual({
      role: 'assistant',
      content: 'Second answer'
    })
  })

  it('never leaves two consecutive user turns for a provider that requires alternating roles', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Follow-up question' }
    ]

    const result = appendRelatedQuestionsReminder(messages, 'google')

    expect(result.map(message => message.role)).toEqual([
      'user',
      'assistant',
      'user'
    ])
    expect(result.at(-1)).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Follow-up question' },
        { type: 'text', text: RELATED_QUESTIONS_REMINDER }
      ]
    })
    expect(messages.at(-1)).toEqual({
      role: 'user',
      content: 'Follow-up question'
    })
  })

  it('uses its own message for a provider that accepts consecutive user turns', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Follow-up question' }
    ]

    const result = appendRelatedQuestionsReminder(messages, 'openai')

    expect(result.at(-1)).toEqual({
      role: 'user',
      content: [{ type: 'text', text: RELATED_QUESTIONS_REMINDER }]
    })
    expect(result.at(-2)).toBe(messages.at(-1))
  })
})
