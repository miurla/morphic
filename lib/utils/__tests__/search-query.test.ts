import { describe, expect, it } from 'vitest'

import { MAX_QUERY_LENGTH, normalizeSearchQuery } from '../search-query'

describe('normalizeSearchQuery', () => {
  it('trims and passes short queries through unchanged', () => {
    expect(normalizeSearchQuery('  frost  ')).toBe('frost')
  })

  it('returns empty for blank input', () => {
    expect(normalizeSearchQuery('   \n\t ')).toBe('')
  })

  it('caps a whitespace-free token at the bound', () => {
    expect(normalizeSearchQuery('x'.repeat(500))).toHaveLength(MAX_QUERY_LENGTH)
  })

  it('truncates at a whitespace boundary, dropping the partial token', () => {
    expect(normalizeSearchQuery('note '.repeat(40) + 'kiwi')).toBe(
      'note '.repeat(40).trim()
    )
    expect(normalizeSearchQuery('note\n'.repeat(39) + 'golden')).toBe(
      'note\n'.repeat(38) + 'note'
    )
  })

  it('never leaves a lone surrogate behind when the cap splits a pair', () => {
    const result = normalizeSearchQuery('a' + '😀'.repeat(100))

    // the 200-code-unit cut lands inside the 100th emoji; the dangling
    // high surrogate would make encodeURIComponent throw
    expect(result).toBe('a' + '😀'.repeat(99))
    expect(() => encodeURIComponent(result)).not.toThrow()
  })

  it('strips lone surrogates present in the raw input', () => {
    const result = normalizeSearchQuery('a\uD800b\uDC00c')

    expect(result).toBe('abc')
    expect(() => encodeURIComponent(result)).not.toThrow()
  })
})
