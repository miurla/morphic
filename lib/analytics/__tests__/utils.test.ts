import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  calculateConversationTurn,
  deriveQueryShape
} from '@/lib/analytics/utils'

const userMsg = (id: string): UIMessage => ({ id, role: 'user', parts: [] })
const assistantMsg = (id: string): UIMessage => ({
  id,
  role: 'assistant',
  parts: []
})

describe('deriveQueryShape', () => {
  it('buckets query length and never returns raw text', () => {
    expect(deriveQueryShape('hi').queryLenBucket).toBe('0-20')
    expect(deriveQueryShape('a'.repeat(40)).queryLenBucket).toBe('21-50')
    expect(deriveQueryShape('a'.repeat(100)).queryLenBucket).toBe('51-120')
    expect(deriveQueryShape('a'.repeat(200)).queryLenBucket).toBe('120+')
  })

  it('detects URLs', () => {
    expect(deriveQueryShape('see https://example.com').hasUrl).toBe(true)
    expect(deriveQueryShape('no link here').hasUrl).toBe(false)
  })

  it('detects coarse language', () => {
    expect(deriveQueryShape('english query').lang).toBe('en')
    expect(deriveQueryShape('日本語のクエリ').lang).toBe('other')
    expect(deriveQueryShape('日本語 with latin').lang).toBe('other')
    expect(deriveQueryShape('12345').lang).toBe('other')
  })
})

describe('calculateConversationTurn', () => {
  const history = [userMsg('u1'), assistantMsg('a1')]

  it('counts the current message once when history excludes it (stale cache)', () => {
    expect(calculateConversationTurn(history, 'u2')).toBe(2)
  })

  it('counts the current message once when history already includes it', () => {
    const fresh = [...history, userMsg('u2')]
    expect(calculateConversationTurn(fresh, 'u2')).toBe(2)
  })

  it('returns at least 1', () => {
    expect(calculateConversationTurn([], 'u1')).toBe(1)
    expect(calculateConversationTurn([])).toBe(1)
  })

  it('counts existing user messages without a current id (regenerate)', () => {
    const fresh = [...history, userMsg('u2')]
    expect(calculateConversationTurn(fresh)).toBe(2)
  })
})
