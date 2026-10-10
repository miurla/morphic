import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  capHistoricalPastedContent,
  parsePastedContentCharBudget
} from '../cap-historical-pasted-content'
import { trimColdStartHistory } from '../trim-cold-start-history'

const BUDGET = 100

function pasteTurn(id: string, length: number, text = 'Is this right?') {
  return {
    id,
    role: 'user',
    parts: [
      {
        type: 'data-pastedContent',
        data: { text: 'x'.repeat(length), nonce: 'abcd1234' }
      },
      { type: 'text', text }
    ]
  } as unknown as UIMessage
}

function textTurn(id: string, role: 'user' | 'assistant' = 'assistant') {
  return {
    id,
    role,
    parts: [{ type: 'text', text: 'Reply' }]
  } as unknown as UIMessage
}

function thread(pasteLengths: number[]): UIMessage[] {
  return pasteLengths.flatMap((length, i) => [
    pasteTurn(`u${i}`, length),
    textTurn(`a${i}`)
  ])
}

function omittedIds(messages: UIMessage[]): string[] {
  return messages
    .filter(message =>
      message.parts.some(
        part =>
          part.type === 'text' &&
          part.text.startsWith('[Pasted content omitted from history')
      )
    )
    .map(message => message.id)
}

describe('capHistoricalPastedContent', () => {
  it('leaves a thread within the budget untouched', () => {
    const messages = [...thread([40, 40]), textTurn('u2', 'user')]
    expect(capHistoricalPastedContent(messages, BUDGET)).toBe(messages)
  })

  it('replaces the oldest block with a placeholder naming its size', () => {
    const messages = [...thread([60, 60, 60, 60]), textTurn('u4', 'user')]
    const capped = capHistoricalPastedContent(messages, BUDGET)

    expect(omittedIds(capped)).toEqual(['u0', 'u1'])
    expect(capped[0].parts).toEqual([
      {
        type: 'text',
        text: '[Pasted content omitted from history: 60 characters. Ask the user to paste it again if you need to look at it again.]'
      },
      { type: 'text', text: 'Is this right?' }
    ])
    expect(capped[4]).toBe(messages[4])
  })

  it('keeps the replayed prefix stable between block crossings', () => {
    const lengths = [60, 60, 60, 60]
    const before = capHistoricalPastedContent(
      [...thread(lengths), textTurn('u4', 'user')],
      BUDGET
    )
    const after = capHistoricalPastedContent(
      [...thread([...lengths, 60]), textTurn('u5', 'user')],
      BUDGET
    )

    expect(omittedIds(after)).toEqual(omittedIds(before))
    expect(after.slice(0, before.length - 1)).toEqual(before.slice(0, -1))
  })

  it('keeps only the newest historical paste when each exceeds the budget', () => {
    const dropped = [1, 2, 3, 4].map(count =>
      omittedIds(
        capHistoricalPastedContent(
          [...thread(Array(count).fill(500)), textTurn('next', 'user')],
          BUDGET
        )
      )
    )

    expect(dropped).toEqual([[], ['u0'], ['u0', 'u1'], ['u0', 'u1', 'u2']])
  })

  it('keeps a small paste that follows an oversized one', () => {
    const messages = [...thread([500, 500, 10]), textTurn('u3', 'user')]

    expect(omittedIds(capHistoricalPastedContent(messages, BUDGET))).toEqual([
      'u0'
    ])
  })

  it('never caps the newest user message', () => {
    const messages = [...thread([60, 60, 60, 60]), pasteTurn('u4', 5000)]
    const capped = capHistoricalPastedContent(messages, BUDGET)

    expect(capped[capped.length - 1]).toBe(messages[messages.length - 1])
  })

  it('ignores pasted parts without text', () => {
    const empty = {
      id: 'empty',
      role: 'user',
      parts: [{ type: 'data-pastedContent', data: {} }]
    } as unknown as UIMessage
    const messages = [empty, ...thread([60, 60]), textTurn('u2', 'user')]

    expect(capHistoricalPastedContent(messages, BUDGET)).toBe(messages)
  })

  it('is disabled by a zero budget', () => {
    const messages = [...thread([500, 500, 500, 500]), textTurn('u4', 'user')]
    expect(capHistoricalPastedContent(messages, 0)).toBe(messages)
  })
})

describe('capHistoricalPastedContent before the cold-start trim', () => {
  const start = Date.parse('2026-01-01T00:00:00Z')
  const minute = 60 * 1000

  function at(message: UIMessage, minutes: number): UIMessage {
    return {
      ...message,
      metadata: { createdAt: new Date(start + minutes * minute).toISOString() }
    } as UIMessage
  }

  const history = [0, 1, 2, 3, 4].flatMap(i => [
    at(pasteTurn(`u${i}`, 4000), i),
    textTurn(`a${i}`)
  ])
  const messages = [...history, at(textTurn('u5', 'user'), 120)]
  const options = { now: new Date(start + 120 * minute), limit: 2500 }

  it('keeps the turns a cold return would otherwise drop', () => {
    const uncapped = trimColdStartHistory(messages, options).messages
    const capped = trimColdStartHistory(
      capHistoricalPastedContent(messages, 4000),
      options
    ).messages

    expect(uncapped.length).toBeLessThan(messages.length)
    expect(capped.map(message => message.id)).toEqual(
      messages.map(message => message.id)
    )
  })
})

describe('parsePastedContentCharBudget', () => {
  it('falls back to the default on unusable values', () => {
    for (const raw of [undefined, '', '  ', 'abc', '-1']) {
      expect(parsePastedContentCharBudget(raw)).toBe(200_000)
    }
  })

  it('disables the budget only on an explicit zero', () => {
    expect(parsePastedContentCharBudget('0')).toBe(0)
    expect(parsePastedContentCharBudget('0.5')).toBe(1)
    expect(parsePastedContentCharBudget('1200.9')).toBe(1200)
  })
})
