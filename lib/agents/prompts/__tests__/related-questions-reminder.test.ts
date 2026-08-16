import type { ModelMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  appendRelatedQuestionsReminder,
  RELATED_QUESTIONS_REMINDER
} from '../related-questions-reminder'

describe('appendRelatedQuestionsReminder', () => {
  it('places the reminder after the current user text in a deep conversation', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Follow-up question' }
    ]

    const result = appendRelatedQuestionsReminder(messages)

    expect(result).not.toBe(messages)
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

  it('preserves non-text parts on the current user message', () => {
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

    const result = appendRelatedQuestionsReminder(messages)

    expect(result[0].content).toEqual([
      { type: 'text', text: 'Describe this file' },
      {
        type: 'file',
        data: new Uint8Array([1, 2, 3]),
        mediaType: 'application/pdf'
      },
      { type: 'text', text: RELATED_QUESTIONS_REMINDER }
    ])
  })

  it('leaves messages unchanged when there is no user message', () => {
    const messages: ModelMessage[] = [
      { role: 'assistant', content: 'Existing answer' }
    ]

    expect(appendRelatedQuestionsReminder(messages)).toBe(messages)
  })
})
