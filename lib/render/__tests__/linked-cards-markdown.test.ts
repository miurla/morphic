import { describe, expect, test } from 'vitest'

import { linkedCardsFenceToMarkdown } from '../linked-cards-markdown'
import { parseSpecBlock } from '../parse-spec-block'
import { stripSpecBlocks } from '../strip-spec-blocks'

const CARDS_SOURCE = [
  '{"op":"add","path":"/root","value":"cards"}',
  '{"op":"add","path":"/elements/cards","value":{"type":"Grid","props":{"columns":2},"children":["c1","c2"]}}',
  '{"op":"add","path":"/elements/c1","value":{"type":"Card","props":{"href":"https://sqlbolt.com/"},"children":["c1t","c1d","c1b"]}}',
  '{"op":"add","path":"/elements/c1t","value":{"type":"Text","props":{"text":"SQLBolt","weight":"semibold"},"children":[]}}',
  '{"op":"add","path":"/elements/c1d","value":{"type":"Text","props":{"text":"Interactive lessons.","tone":"muted"},"children":[]}}',
  '{"op":"add","path":"/elements/c1b","value":{"type":"Badge","props":{"text":"Free"},"children":[]}}',
  '{"op":"add","path":"/elements/c2","value":{"type":"Card","props":{"href":"https://mode.com/sql-tutorial/"},"children":["c2t"]}}',
  '{"op":"add","path":"/elements/c2t","value":{"type":"Text","props":{"text":"Mode SQL Tutorial","weight":"semibold"},"children":[]}}'
].join('\n')

const CARDS_FENCE = ['```spec', CARDS_SOURCE, '```'].join('\n')

describe('linked card spec', () => {
  test('validates against the catalog', () => {
    const spec = parseSpecBlock(CARDS_SOURCE)
    expect(spec.elements.c1.type).toBe('Card')
    expect(spec.elements.c1t.type).toBe('Text')
    expect(spec.elements.c1b.type).toBe('Badge')
  })
})

describe('linkedCardsFenceToMarkdown', () => {
  test('renders each linked card as a markdown link', () => {
    expect(linkedCardsFenceToMarkdown(CARDS_FENCE)).toBe(
      [
        '- [SQLBolt](https://sqlbolt.com/): Interactive lessons. (Free)',
        '- [Mode SQL Tutorial](https://mode.com/sql-tutorial/)'
      ].join('\n')
    )
  })

  test('follows the rendered order, not the definition order', () => {
    const fence = [
      '```spec',
      '{"op":"add","path":"/root","value":"g"}',
      '{"op":"add","path":"/elements/g","value":{"type":"Grid","props":{"columns":2},"children":["c2","c1"]}}',
      '{"op":"add","path":"/elements/c1","value":{"type":"Card","props":{"href":"https://one.example/"},"children":["t1"]}}',
      '{"op":"add","path":"/elements/t1","value":{"type":"Text","props":{"text":"One"},"children":[]}}',
      '{"op":"add","path":"/elements/c2","value":{"type":"Card","props":{"href":"https://two.example/"},"children":["t2"]}}',
      '{"op":"add","path":"/elements/t2","value":{"type":"Text","props":{"text":"Two"},"children":[]}}',
      '```'
    ].join('\n')
    expect(linkedCardsFenceToMarkdown(fence)).toBe(
      '- [Two](https://two.example/)\n- [One](https://one.example/)'
    )
  })

  test('skips cards the root does not reach', () => {
    const fence = [
      '```spec',
      '{"op":"add","path":"/root","value":"g"}',
      '{"op":"add","path":"/elements/g","value":{"type":"Grid","props":{"columns":1},"children":["c1"]}}',
      '{"op":"add","path":"/elements/c1","value":{"type":"Card","props":{"href":"https://one.example/"},"children":[]}}',
      '{"op":"add","path":"/elements/orphan","value":{"type":"Card","props":{"href":"https://orphan.example/"},"children":[]}}',
      '```'
    ].join('\n')
    expect(linkedCardsFenceToMarkdown(fence)).toBe(
      '- [https://one.example/](https://one.example/)'
    )
  })

  test('keeps the cards that render when one line is malformed', () => {
    const fence = [
      '```spec',
      '{"op":"add","path":"/root","value":"g"}',
      '{"op":"add","path":"/elements/g","value":{"type":"Grid","props":{"columns":2},"children":["c1","c2"]}}',
      '{"op":"add","path":"/elements/c1","value":{"type":"Card","props":{"href":"https://one.example/"},"children":["t1"]}}',
      '{"op":"add","path":"/elements/t1","value":{"type":"Text","props":{"text":"One"},"children":[]}}',
      '{"op":"add","path":"/elements/c2","value":{"type":"Card","props":{"href":',
      '```'
    ].join('\n')
    expect(linkedCardsFenceToMarkdown(fence)).toBe(
      '- [One](https://one.example/)'
    )
  })

  test('returns null instead of throwing for malformed children', () => {
    const fence = [
      '```spec',
      '{"op":"add","path":"/root","value":"g"}',
      '{"op":"add","path":"/elements/g","value":{"type":"Grid","props":{"columns":2},"children":"c1"}}',
      '{"op":"add","path":"/elements/c1","value":{"type":"Card","props":{"href":"https://one.example/"},"children":"t1"}}',
      '```'
    ].join('\n')
    expect(() => linkedCardsFenceToMarkdown(fence)).not.toThrow()
    expect(linkedCardsFenceToMarkdown(fence)).toBeNull()
    expect(() => stripSpecBlocks(`Answer.\n\n${fence}`)).not.toThrow()
  })

  test('returns null for cards without href', () => {
    const fence = [
      '```spec',
      '{"op":"add","path":"/root","value":"c"}',
      '{"op":"add","path":"/elements/c","value":{"type":"Card","props":{},"children":["t"]}}',
      '{"op":"add","path":"/elements/t","value":{"type":"Text","props":{"text":"Note"},"children":[]}}',
      '```'
    ].join('\n')
    expect(linkedCardsFenceToMarkdown(fence)).toBeNull()
  })

  test('returns null for a fence without cards', () => {
    const fence = [
      '```spec',
      '{"op":"add","path":"/root","value":"x"}',
      '```'
    ].join('\n')
    expect(linkedCardsFenceToMarkdown(fence)).toBeNull()
  })

  test('returns null for an unparseable fence', () => {
    const fence = ['```spec', '{"type":"Card" broken', '```'].join('\n')
    expect(linkedCardsFenceToMarkdown(fence)).toBeNull()
  })
})

describe('stripSpecBlocks with linked cards', () => {
  test('keeps the cards as a list when copying', () => {
    const result = stripSpecBlocks(`Lead-in.\n\n${CARDS_FENCE}\n\nClosing.`)
    expect(result).not.toContain('```spec')
    expect(result).toContain('- [SQLBolt](https://sqlbolt.com/)')
    expect(result).toContain('Closing.')
  })
})
