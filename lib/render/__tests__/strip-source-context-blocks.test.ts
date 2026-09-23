import { describe, expect, it } from 'vitest'

import {
  SOURCE_CONTEXT_WARNING,
  stripSourceContextBlocks
} from '../strip-source-context-blocks'

const block = (body: string) =>
  `<source_context>\n${SOURCE_CONTEXT_WARNING}\n\n${body}\n</source_context>`

describe('stripSourceContextBlocks', () => {
  it('removes a closed block', () => {
    expect(stripSourceContextBlocks(`Answer\n\n${block('1. Evidence')}`)).toBe(
      'Answer'
    )
  })

  it('removes multiple closed blocks', () => {
    expect(
      stripSourceContextBlocks(
        `First\n${block('one')}\n\n\nSecond\n${block('two')}`
      )
    ).toBe('First\n\nSecond')
  })

  it('removes a truncated trailing block', () => {
    expect(
      stripSourceContextBlocks(
        `Answer\n<source_context>\n${SOURCE_CONTEXT_WARNING}\n\n1. Trunc`
      )
    ).toBe('Answer')
  })

  it('removes a block cut off inside the opening warning', () => {
    expect(
      stripSourceContextBlocks('Answer\n<source_context>\nThese are untrus')
    ).toBe('Answer')
    expect(stripSourceContextBlocks('Answer\n<source_context>')).toBe('Answer')
  })

  it('keeps literal source_context markup that is not the application block', () => {
    const closed =
      'Wrap it like `<source_context>example</source_context>` in the prompt.'
    const open = 'The tag <source_context> starts the block.'

    expect(stripSourceContextBlocks(closed)).toBe(closed)
    expect(stripSourceContextBlocks(open)).toBe(open)
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
