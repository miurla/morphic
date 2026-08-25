import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  parseAnswerTextExemptTurns,
  parseAnswerTextLimit
} from '../cap-historical-answer-text'
import { compactHistoricalMessages } from '../compact-historical-messages'

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

function emptyAssistantTurn(id: string): UIMessage {
  return assistantTurn(id, '   ')
}

function toolOnlyAssistantTurn(id: string): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [
      {
        type: 'tool-search',
        toolCallId: `call_${id}`,
        state: 'output-available',
        input: { query: 'example' },
        output: { query: 'example', images: [], results: [] }
      }
    ]
  } as unknown as UIMessage
}

function citedAssistantTurn(id: string, text: string): UIMessage {
  return {
    id,
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
              title: 'Example source',
              url: 'https://example.com/a-long-source-path',
              content:
                'Evidence that must remain available after answer capping.'
            }
          ]
        }
      },
      { type: 'text', text }
    ]
  } as unknown as UIMessage
}

function thread(answerLengths: number[]): UIMessage[] {
  return answerLengths.flatMap((length, index) => [
    userTurn(`u${index}`),
    assistantTurn(`a${index}`, `${index}:${'x'.repeat(length)}`)
  ])
}

function compact(
  messages: UIMessage[],
  maxChars = LIMIT,
  exemptCount = 0
): UIMessage[] {
  return compactHistoricalMessages(messages, { maxChars, exemptCount })
}

function textParts(message: UIMessage): string[] {
  return message.parts.flatMap(part =>
    part.type === 'text' ? [part.text] : []
  )
}

function placeholders(message: UIMessage): string[] {
  return textParts(message).filter(text => text.startsWith(PLACEHOLDER_PREFIX))
}

describe('historical answer text cap', () => {
  it('returns answers under the limit without a placeholder', () => {
    const messages = thread([5, 5]).concat(userTurn('current'))
    const capped = compact(messages)

    expect(capped.flatMap(placeholders)).toEqual([])
    expect(textParts(capped[1])).toEqual(textParts(messages[1]))
    expect(textParts(capped[3])).toEqual(textParts(messages[3]))
  })

  it('truncates an older long answer and adds one placeholder', () => {
    const messages = thread([100, 5]).concat(userTurn('current'))
    const capped = compact(messages, LIMIT, 1)
    const oldAnswer = capped[1]

    expect(textParts(oldAnswer)[0]).toHaveLength(LIMIT)
    expect(placeholders(oldAnswer)).toHaveLength(1)
  })

  it('exempts the newest historical assistant answers', () => {
    const messages = thread([100, 100, 100, 100]).concat(userTurn('current'))
    const capped = compact(messages, LIMIT, 2)

    expect(placeholders(capped[1])).toHaveLength(1)
    expect(placeholders(capped[3])).toHaveLength(1)
    expect(placeholders(capped[5])).toEqual([])
    expect(placeholders(capped[7])).toEqual([])
  })

  it('does not count an empty assistant between answers as exempt', () => {
    const messages = [
      assistantTurn('a0', 'x'.repeat(100)),
      emptyAssistantTurn('empty'),
      assistantTurn('a1', 'x'.repeat(100)),
      assistantTurn('a2', 'x'.repeat(100)),
      userTurn('current')
    ]
    const capped = compact(messages, LIMIT, 2)

    expect(capped.map(message => message.id)).toEqual([
      'a0',
      'a1',
      'a2',
      'current'
    ])
    expect(placeholders(capped[0])).toHaveLength(1)
    expect(placeholders(capped[1])).toEqual([])
    expect(placeholders(capped[2])).toEqual([])
  })

  it('ignores trailing empty and tool-only assistants for exemptions', () => {
    const messages = [
      assistantTurn('a0', 'x'.repeat(100)),
      assistantTurn('a1', 'x'.repeat(100)),
      assistantTurn('a2', 'x'.repeat(100)),
      emptyAssistantTurn('empty-1'),
      toolOnlyAssistantTurn('tool-only'),
      emptyAssistantTurn('empty-2'),
      userTurn('current')
    ]
    const capped = compact(messages, LIMIT, 2)

    expect(capped.map(message => message.id)).toEqual([
      'a0',
      'a1',
      'a2',
      'current'
    ])
    expect(placeholders(capped[0])).toHaveLength(1)
    expect(placeholders(capped[1])).toEqual([])
    expect(placeholders(capped[2])).toEqual([])
  })

  it('leaves messages at or after the history boundary uncapped', () => {
    const messages = [
      ...thread([100]),
      userTurn('current'),
      assistantTurn('current-assistant', 'x'.repeat(100))
    ]
    const capped = compact(messages)

    expect(capped.at(-2)).toBe(messages.at(-2))
    expect(textParts(capped.at(-1)!)).toEqual(['x'.repeat(100)])
    expect(placeholders(capped.at(-1)!)).toEqual([])
  })

  it('keeps capped prefix text stable as the thread grows', () => {
    const fullThread = thread(Array.from({ length: 8 }, () => 100))
    const rendered = [4, 6, 8].map(turnCount =>
      compact(
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
      compact(
        fullThread.slice(0, turnCount * 2).concat(userTurn('current')),
        LIMIT,
        2
      )
    const shorter = render(4)
    const longer = render(6)

    expect(placeholders(shorter[5])).toEqual([])
    expect(placeholders(longer[5])).toHaveLength(1)

    for (const messageIndex of [0, 1, 2, 3, 4]) {
      expect(textParts(longer[messageIndex])).toEqual(
        textParts(shorter[messageIndex])
      )
    }
  })

  it('keeps prefix stability with empty assistant records', () => {
    const replayableTurns = Array.from({ length: 6 }, (_, index) => [
      assistantTurn(`a${index}`, 'x'.repeat(100)),
      emptyAssistantTurn(`empty-${index}`)
    ]).flat()
    const render = (replayableCount: number) =>
      compact(
        replayableTurns
          .slice(0, replayableCount * 2)
          .concat(userTurn('current')),
        LIMIT,
        2
      )
    const shorter = render(4)
    const longer = render(6)

    expect(placeholders(shorter[2])).toEqual([])
    expect(placeholders(longer[2])).toHaveLength(1)

    for (const messageIndex of [0, 1]) {
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
    const originalParts = structuredClone(assistant.parts)
    const capped = compact([assistant, userTurn('current')])[0]

    expect(textParts(capped)).toEqual([
      '1234567890',
      'abcdefghij',
      expect.stringContaining(PLACEHOLDER_PREFIX)
    ])
    expect(capped.parts).not.toContain(assistant.parts[1])
    expect(assistant.parts).toEqual(originalParts)
  })

  it('does not split a surrogate pair at the boundary', () => {
    const answer = assistantTurn('a0', `${'x'.repeat(19)}😀after`)
    const capped = compact([answer, userTurn('current')])[0]

    expect(textParts(capped)[0]).toBe('x'.repeat(19))
    expect(textParts(capped).join('')).not.toMatch(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
    )
  })

  it('cuts at whitespace and strips incomplete compact and expanded citations', () => {
    const whitespaceAnswer = assistantTurn(
      'whitespace',
      'complete words unfinishedword'
    )
    const compactCitationAnswer = assistantTurn(
      'compact-citation',
      'answer[12](#toolu_01abcdef) trailing'
    )
    const expandedCitationAnswer = citedAssistantTurn(
      'expanded-citation',
      'answer[1](#call_1) trailing'
    )
    const capped = compact(
      [
        whitespaceAnswer,
        compactCitationAnswer,
        expandedCitationAnswer,
        userTurn('current')
      ],
      24
    )

    expect(textParts(capped[0])[0]).toBe('complete words')
    expect(textParts(capped[1])[0]).toBe('answer')
    expect(textParts(capped[2])[0]).toBe('answer')
  })

  it('measures the cap after compact citations are expanded', () => {
    const answer = citedAssistantTurn('cited', 'Answer[1](#call_1)')
    const compactText = textParts(answer).at(-1)!
    const maxChars = compactText.length
    const expandedText = textParts(
      compact([answer, userTurn('current')], 0)[0]
    )[0]
    const capped = compact([answer, userTurn('current')], maxChars)[0]
    const [answerText] = textParts(capped)

    expect(compactText).toHaveLength(maxChars)
    expect(expandedText).toBe(
      'Answer[example](https://example.com/a-long-source-path)'
    )
    expect(expandedText.length).toBeGreaterThan(maxChars)
    expect(answerText).toBe('Answer')
    expect(answerText.length).toBeLessThanOrEqual(maxChars)
    expect(placeholders(capped)).toHaveLength(1)
  })

  it('adds unchanged source context after the capped answer budget', () => {
    const answer = citedAssistantTurn(
      'cited',
      `Long answer text ${'x'.repeat(50)} [1](#call_1)`
    )
    const messages = [answer, userTurn('current')]
    const capped = compact(messages, 10)[0]
    const uncapped = compact(messages, 0)[0]
    const cappedTexts = textParts(capped)
    const sourceContext = cappedTexts.at(-1)!

    expect(cappedTexts[0].length).toBeLessThanOrEqual(10)
    expect(placeholders(capped)).toHaveLength(1)
    expect(sourceContext).toBe(textParts(uncapped).at(-1))
    expect(sourceContext.length).toBeGreaterThan(10)
    expect(sourceContext).toContain('Evidence that must remain available')
    expect(sourceContext).toContain('https://example.com/a-long-source-path')
  })

  it('disables the cap with an explicit zero limit', () => {
    const messages = thread([100]).concat(userTurn('current'))
    const capped = compact(messages, 0)

    expect(textParts(capped[1])).toEqual(textParts(messages[1]))
    expect(placeholders(capped[1])).toEqual([])
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
