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

  it('keeps a token that ends exactly at the cap', () => {
    // the 200th code unit is the last 'x' and the original continues with
    // whitespace: the token is complete and must survive
    expect(normalizeSearchQuery('a ' + 'x'.repeat(198) + ' y')).toBe(
      'a ' + 'x'.repeat(198)
    )
  })

  it('drops the whole fragment when the cap splits a hyphenated token', () => {
    const prefix = 'note '.repeat(39) // 195 characters
    // cut immediately after the hyphen: the retained 'foo-' parses to the
    // 'foo' component and would match chats without foo-bar
    expect(normalizeSearchQuery(prefix + 'xfoo-bar')).toBe(prefix.trim())
    // cut immediately before the hyphen: the hyphen continues the hword,
    // but the complete 'x' before the compound token is kept
    expect(normalizeSearchQuery(prefix + 'x foo-bar')).toBe(
      (prefix + 'x').trim()
    )
  })

  it('drops the whole fragment when the cap splits a numeric token', () => {
    const prefix = 'note '.repeat(39) // 195 characters
    // cap lands between '1' and '.': 'wxyz1' is a numword the parser could
    // continue into a compound token, so the whole fragment goes
    expect(normalizeSearchQuery(prefix + 'wxyz1.23')).toBe(prefix.trim())
    // cap lands between 'z' and '1': 'vwxyz1' would parse as one numword
    expect(normalizeSearchQuery(prefix + 'vwxyz1.23')).toBe(prefix.trim())
    // Codex's example shape: the cap cuts 'x1.23' after the digit, leaving
    // a retained '1' that would suppress otherwise-matching histories
    expect(normalizeSearchQuery(prefix + 'w x1.23')).toBe(prefix + 'w')
  })

  it('drops the whole fragment when the cap splits an email token', () => {
    const prefix = 'note '.repeat(39) // 195 characters
    expect(normalizeSearchQuery(prefix + 'user@example.com')).toBe(
      prefix.trim()
    )
  })

  it('drops the trailing word when the cap lands on an underscore', () => {
    const prefix = 'note '.repeat(39) // 195 characters
    // cap immediately after '_': the unfinished word goes with the fragment
    expect(normalizeSearchQuery(prefix + 'foob_bar')).toBe(prefix.trim())
    // cap inside the segment following '_': 'xfo_o' + 'bar' would leave a
    // capped word ending in the underscore
    expect(normalizeSearchQuery(prefix + 'xfo_obar')).toBe(prefix.trim())
    // cap immediately before '_': the underscore splits tokens, so the
    // preceding word is complete and stays
    expect(normalizeSearchQuery(prefix + 'foobx_bar')).toBe(prefix + 'foobx')
  })

  it('treats punctuation after the cap as a token boundary, like the parser', () => {
    // Postgres ends a word token at '!' just as it does at a space, so the
    // 198-character token is complete at the cap and must survive; only a
    // word character after the cap means the cap split a token.
    expect(normalizeSearchQuery('a ' + 'x'.repeat(198) + '! y')).toBe(
      'a ' + 'x'.repeat(198)
    )
  })

  it('drops a token sliced by the cap at a punctuation boundary', () => {
    // no whitespace anywhere, but '!' ends the first token; the second
    // token is sliced by the cap and must be dropped rather than act as a
    // broad prefix match
    expect(normalizeSearchQuery('aaa!' + 'b'.repeat(200))).toBe('aaa!')
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
