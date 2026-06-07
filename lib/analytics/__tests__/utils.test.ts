import { describe, expect, it } from 'vitest'

import { deriveQueryShape } from '@/lib/analytics/utils'

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
