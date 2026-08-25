import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  capHistoricalAnswerText,
  parseAnswerTextExemptTurns,
  parseAnswerTextLimit
} from '../cap-historical-answer-text'

const LIMIT = 20
const PLACEHOLDER_PREFIX = '[Earlier answer text omitted'

function userTurn(id: string, text = 'Question'): UIMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }]
  } as UIMessage
}

function assistantTurn(id: string, text: string): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text }]
  } as UIMessage
}

function thread(answerLengths: number[]): UIMessage[] {
  return answerLengths.flatMap((length, index) => [
    userTurn(`u${index}`),
    assistantTurn(`a${index}`, `${index}:${'x'.repeat(length)}`)
  ])
}

function textParts(message: UIMessage): string[] {
  return message.parts.flatMap(part =>
    part.type === 'text' ? [part.text] : []
  )
}

function placeholders(message: UIMessage): string[] {
  return textParts(message).filter(text => text.startsWith(PLACEHOLDER_PREFIX))
}

describe('capHistoricalAnswerText', () => {
  it('returns answers under the limit unchanged', () => {
    const messages = thread([5, 5]).concat(userTurn('current'))

    const capped = capHistoricalAnswerText(messages, LIMIT, 0)

    expect(capped).toBe(messages)
    expect(capped.flatMap(placeholders)).toEqual([])
  })

  it('truncates an older long answer and adds one placeholder', () => {
    const messages = thread([100, 5]).concat(userTurn('current'))
    const capped = capHistoricalAnswerText(messages, LIMIT, 1)
    const oldAnswer = capped[1]

    expect(textParts(oldAnswer)[0]).toHaveLength(LIMIT)
    expect(placeholders(oldAnswer)).toHaveLength(1)
  })

  it('exempts the newest historical assistant answers', () => {
    const messages = thread([100, 100, 100, 100]).concat(userTurn('current'))
    const capped = capHistoricalAnswerText(messages, LIMIT, 2)

    expect(placeholders(capped[1])).toHaveLength(1)
    expect(placeholders(capped[3])).toHaveLength(1)
    expect(capped[5]).toBe(messages[5])
    expect(capped[7]).toBe(messages[7])
  })

  it('leaves messages at or after the history boundary untouched', () => {
    const messages = [
      ...thread([100]),
      userTurn('current'),
      assistantTurn('current-assistant', 'x'.repeat(100))
    ]
    const capped = capHistoricalAnswerText(messages, LIMIT, 0)

    expect(capped.at(-2)).toBe(messages.at(-2))
    expect(capped.at(-1)).toBe(messages.at(-1))
  })

  it('keeps capped prefix text stable as the thread grows', () => {
    const fullThread = thread(Array.from({ length: 8 }, () => 100))
    const rendered = [4, 6, 8].map(turnCount =>
      capHistoricalAnswerText(
        fullThread.slice(0, turnCount * 2).concat(userTurn('current')),
        LIMIT,
        2
      )
    )

    for (let assistantIndex = 0; assistantIndex < 2; assistantIndex++) {
      const messageIndex = assistantIndex * 2 + 1
      const baseline = JSON.stringify(textParts(rendered[0][messageIndex]))

      for (const messages of rendered.slice(1)) {
        expect(JSON.stringify(textParts(messages[messageIndex]))).toBe(baseline)
      }
    }
  })

  it('moves the divergence point only within the exempt tail', () => {
    const fullThread = thread(Array.from({ length: 8 }, () => 100))
    const render = (turnCount: number) =>
      capHistoricalAnswerText(
        fullThread.slice(0, turnCount * 2).concat(userTurn('current')),
        LIMIT,
        2
      )
    const shorter = render(4)
    const longer = render(6)

    // The answer that was exempt at the shorter length is the first one to
    // change, and it sits within the exempt tail of the shorter render.
    expect(placeholders(shorter[5])).toEqual([])
    expect(placeholders(longer[5])).toHaveLength(1)

    // Everything before it is byte-identical, which is what the prompt cache
    // matches on.
    for (const messageIndex of [0, 1, 2, 3, 4]) {
      expect(textParts(longer[messageIndex])).toEqual(
        textParts(shorter[messageIndex])
      )
    }
  })

  it('caps total answer text across multiple text parts', () => {
    const assistant = {
      id: 'a0',
      role: 'assistant',
      parts: [
        { type: 'text', text: '1234567890' },
        { type: 'data-status', data: { status: 'done' } },
        { type: 'text', text: 'abcdefghijklmno' },
        { type: 'text', text: 'dropped' }
      ]
    } as unknown as UIMessage
    const capped = capHistoricalAnswerText(
      [assistant, userTurn('current')],
      LIMIT,
      0
    )[0]

    expect(textParts(capped)).toEqual([
      '1234567890',
      'abcdefghij',
      expect.stringContaining(PLACEHOLDER_PREFIX)
    ])
    expect(capped.parts).toContain(assistant.parts[1])
  })

  it('does not split a surrogate pair at the boundary', () => {
    const answer = assistantTurn('a0', `${'x'.repeat(19)}😀after`)
    const capped = capHistoricalAnswerText(
      [answer, userTurn('current')],
      LIMIT,
      0
    )[0]

    expect(textParts(capped)[0]).toBe('x'.repeat(19))
    expect(textParts(capped).join('')).not.toMatch(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
    )
  })

  it('cuts at whitespace and removes an incomplete citation', () => {
    const whitespaceAnswer = assistantTurn(
      'whitespace',
      'complete words unfinishedword'
    )
    const citationAnswer = assistantTurn(
      'citation',
      'answer[12](#toolu_01abcdef) trailing'
    )
    const capped = capHistoricalAnswerText(
      [whitespaceAnswer, citationAnswer, userTurn('current')],
      24,
      0
    )

    expect(textParts(capped[0])[0]).toBe('complete words')
    expect(textParts(capped[1])[0]).toBe('answer')
  })

  it('disables the cap with an explicit zero limit', () => {
    const messages = thread([100]).concat(userTurn('current'))

    expect(capHistoricalAnswerText(messages, 0, 0)).toBe(messages)
  })
})

describe('answer text configuration parsing', () => {
  it('falls back to defaults for empty and malformed values', () => {
    for (const raw of [undefined, '', '   ', 'nope', '-1', 'Infinity']) {
      expect(parseAnswerTextLimit(raw)).toBe(12_000)
      expect(parseAnswerTextExemptTurns(raw)).toBe(2)
    }
  })

  it('accepts explicit zero and floors positive values', () => {
    expect(parseAnswerTextLimit('0')).toBe(0)
    expect(parseAnswerTextLimit('12.9')).toBe(12)
    expect(parseAnswerTextExemptTurns('0')).toBe(0)
    expect(parseAnswerTextExemptTurns('3.9')).toBe(3)
  })
})
