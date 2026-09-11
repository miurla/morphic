import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  parseColdStartHistoryTokenLimit,
  trimColdStartHistory
} from '../trim-cold-start-history'

const START = new Date('2026-01-01T00:00:00.000Z')
const WARM_GAP_MS = 30 * 60 * 1000
const COLD_GAP_MS = WARM_GAP_MS + 1

function timestamp(offsetMs: number): Date {
  return new Date(START.getTime() + offsetMs)
}

function message(
  id: string,
  role: 'user' | 'assistant',
  createdAt: Date | string | undefined,
  parts: UIMessage['parts'] = [{ type: 'text', text: 'content'.repeat(8) }]
): UIMessage {
  return {
    id,
    role,
    parts,
    ...(createdAt !== undefined && { metadata: { createdAt } })
  }
}

function turn(
  index: number,
  createdAt: Date | string | undefined,
  assistantParts?: UIMessage['parts']
): UIMessage[] {
  return [
    message(`u${index}`, 'user', createdAt),
    message(`a${index}`, 'assistant', createdAt, assistantParts)
  ]
}

function userIds(messages: UIMessage[]): string[] {
  return messages.filter(item => item.role === 'user').map(item => item.id)
}

describe('trimColdStartHistory', () => {
  it('only advances the cut as cold turns are appended', () => {
    let messages: UIMessage[] = []
    let dropped = new Set<string>()

    for (let i = 0; i < 8; i++) {
      messages = messages.concat(turn(i, timestamp(i * COLD_GAP_MS)))
      const result = trimColdStartHistory(messages, {
        now: timestamp(i * COLD_GAP_MS),
        limit: 20
      })
      const kept = new Set(userIds(result.messages))
      const nextDropped = new Set(userIds(messages).filter(id => !kept.has(id)))

      for (const id of dropped) expect(nextDropped.has(id)).toBe(true)
      dropped = nextDropped
    }

    expect(dropped.size).toBeGreaterThan(0)
  })

  it('keeps the previous output as a prefix when a warm turn is appended', () => {
    const atColdStart = [
      ...turn(0, timestamp(0)),
      ...turn(1, timestamp(WARM_GAP_MS)),
      ...turn(2, timestamp(2 * WARM_GAP_MS)),
      ...turn(3, timestamp(3 * WARM_GAP_MS)),
      ...turn(4, timestamp(3 * WARM_GAP_MS + COLD_GAP_MS))
    ]
    const first = trimColdStartHistory(atColdStart, {
      now: timestamp(3 * WARM_GAP_MS + COLD_GAP_MS),
      limit: 20
    }).messages
    const second = trimColdStartHistory(
      atColdStart.concat(turn(5, timestamp(4 * WARM_GAP_MS + COLD_GAP_MS))),
      {
        now: timestamp(4 * WARM_GAP_MS + COLD_GAP_MS),
        limit: 20
      }
    ).messages

    expect(second.slice(0, first.length)).toEqual(first)
  })

  it('leaves fewer than five turns untouched', () => {
    const messages = Array.from({ length: 4 }, (_, i) =>
      turn(i, timestamp(i * COLD_GAP_MS))
    ).flat()
    const result = trimColdStartHistory(messages, {
      now: timestamp(4 * COLD_GAP_MS),
      limit: 1
    })

    expect(result.messages).toBe(messages)
    expect(result.trimmedAtCurrentTurn).toBe(false)
  })

  it('does not trim when every gap is at most the idle boundary', () => {
    const messages = Array.from({ length: 7 }, (_, i) =>
      turn(i, timestamp(i * WARM_GAP_MS))
    ).flat()

    expect(
      trimColdStartHistory(messages, {
        now: timestamp(7 * WARM_GAP_MS),
        limit: 1
      }).messages
    ).toBe(messages)
  })

  it('does not treat a missing historical timestamp as cold', () => {
    const messages = [
      ...turn(0, timestamp(0)),
      ...turn(1, timestamp(WARM_GAP_MS)),
      ...turn(2, timestamp(2 * WARM_GAP_MS)),
      ...turn(3, undefined),
      ...turn(4, timestamp(2 * WARM_GAP_MS + COLD_GAP_MS))
    ]

    expect(
      trimColdStartHistory(messages, {
        now: timestamp(2 * WARM_GAP_MS + COLD_GAP_MS),
        limit: 1
      }).messages
    ).toBe(messages)
  })

  it('uses now for a missing timestamp on the last user message', () => {
    const now = timestamp(3 * WARM_GAP_MS + COLD_GAP_MS)
    const messages = [
      ...turn(0, timestamp(0)),
      ...turn(1, timestamp(WARM_GAP_MS)),
      ...turn(2, timestamp(2 * WARM_GAP_MS)),
      ...turn(3, timestamp(3 * WARM_GAP_MS)),
      ...turn(4, undefined)
    ]
    const result = trimColdStartHistory(messages, { now, limit: 20 })

    expect(userIds(result.messages)).toEqual(['u0', 'u4'])
    expect(result.trimmedAtCurrentTurn).toBe(true)
  })

  it('keeps the first and current turns whole', () => {
    const toolParts = [
      {
        type: 'tool-search',
        toolCallId: 'call-current',
        state: 'output-available',
        input: { query: 'current' },
        output: { results: ['current'] }
      }
    ] as unknown as UIMessage['parts']
    const messages = [
      ...turn(0, timestamp(0)),
      ...turn(1, timestamp(WARM_GAP_MS), toolParts),
      ...turn(2, timestamp(2 * WARM_GAP_MS)),
      ...turn(3, timestamp(3 * WARM_GAP_MS)),
      ...turn(4, timestamp(3 * WARM_GAP_MS + COLD_GAP_MS), toolParts)
    ]
    const result = trimColdStartHistory(messages, {
      now: timestamp(3 * WARM_GAP_MS + COLD_GAP_MS),
      limit: 20
    })

    expect(result.messages.map(item => item.id)).toEqual([
      'u0',
      'a0',
      'u4',
      'a4'
    ])
    expect(result.messages[0].role).toBe('user')
    expect(result.messages.at(-1)?.parts).toEqual(toolParts)
  })

  it('disables trimming when the limit is zero', () => {
    const messages = Array.from({ length: 6 }, (_, i) =>
      turn(i, timestamp(i * COLD_GAP_MS))
    ).flat()

    expect(
      trimColdStartHistory(messages, {
        now: timestamp(6 * COLD_GAP_MS),
        limit: 0
      }).messages
    ).toBe(messages)
  })

  it('parses the configured limit', () => {
    expect(parseColdStartHistoryTokenLimit(undefined)).toBe(200_000)
    expect(parseColdStartHistoryTokenLimit('')).toBe(200_000)
    expect(parseColdStartHistoryTokenLimit('not-a-number')).toBe(200_000)
    expect(parseColdStartHistoryTokenLimit('-1')).toBe(200_000)
    expect(parseColdStartHistoryTokenLimit('0')).toBe(0)
    expect(parseColdStartHistoryTokenLimit('3.9')).toBe(3)
    expect(parseColdStartHistoryTokenLimit('0.5')).toBe(1)
  })

  it('flags only the turn whose cold event advances the cut', () => {
    const coldMessages = [
      ...turn(0, timestamp(0)),
      ...turn(1, timestamp(WARM_GAP_MS)),
      ...turn(2, timestamp(2 * WARM_GAP_MS)),
      ...turn(3, timestamp(3 * WARM_GAP_MS)),
      ...turn(4, timestamp(3 * WARM_GAP_MS + COLD_GAP_MS))
    ]
    const coldResult = trimColdStartHistory(coldMessages, {
      now: timestamp(3 * WARM_GAP_MS + COLD_GAP_MS),
      limit: 20
    })
    const warmResult = trimColdStartHistory(
      coldMessages.concat(turn(5, timestamp(4 * WARM_GAP_MS + COLD_GAP_MS))),
      {
        now: timestamp(4 * WARM_GAP_MS + COLD_GAP_MS),
        limit: 20
      }
    )

    expect(coldResult.trimmedAtCurrentTurn).toBe(true)
    expect(warmResult.trimmedAtCurrentTurn).toBe(false)
    expect(warmResult.messages.length).toBeLessThan(
      coldMessages.length + turn(5, timestamp(0)).length
    )
  })
})
