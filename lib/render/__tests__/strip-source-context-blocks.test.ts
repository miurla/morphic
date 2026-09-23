import { describe, expect, it } from 'vitest'

import { stripSourceContextBlocks } from '../strip-source-context-blocks'

describe('stripSourceContextBlocks', () => {
  it('removes a closed block', () => {
    expect(
      stripSourceContextBlocks(
        'Answer\n\n<source_context>evidence</source_context>'
      )
    ).toBe('Answer')
  })

  it('removes multiple closed blocks', () => {
    expect(
      stripSourceContextBlocks(
        'First\n<source_context>one</source_context>\n\n\nSecond\n<source_context>two</source_context>'
      )
    ).toBe('First\n\nSecond')
  })

  it('removes a truncated trailing block', () => {
    expect(
      stripSourceContextBlocks('Answer\n<source_context>truncated evidence')
    ).toBe('Answer')
  })

  it('returns text without an opening tag unchanged', () => {
    const text = 'Answer with trailing whitespace  \n'

    expect(stripSourceContextBlocks(text)).toBe(text)
  })

  it('does not remove prose mentioning source_context or angle brackets', () => {
    const text = 'The source_context label means x < y and y > z.'

    expect(stripSourceContextBlocks(text)).toBe(text)
  })
})
