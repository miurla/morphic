import { describe, expect, test } from 'vitest'

import { stripSpecBlocks } from '../strip-spec-blocks'

describe('stripSpecBlocks', () => {
  test('removes a single spec block', () => {
    const input = [
      '## Heading',
      '',
      '```spec',
      '{"op":"add","path":"/root","value":"x"}',
      '```',
      '',
      'tail'
    ].join('\n')

    const result = stripSpecBlocks(input)
    expect(result).not.toContain('```spec')
    expect(result).toContain('## Heading')
    expect(result).toContain('tail')
  })

  test('removes multiple spec blocks interleaved with markdown', () => {
    const input = [
      '## Section A',
      '',
      '```spec',
      '{"op":"add","path":"/root","value":"imgs1"}',
      '```',
      '',
      'Body paragraph between blocks.',
      '',
      '```spec',
      '{"op":"add","path":"/root","value":"imgs2"}',
      '```',
      '',
      'Closing.',
      '',
      '```spec',
      '{"op":"add","path":"/root","value":"related"}',
      '```'
    ].join('\n')

    const result = stripSpecBlocks(input)
    expect(result).not.toContain('```spec')
    expect(result).not.toContain('imgs1')
    expect(result).not.toContain('imgs2')
    expect(result).not.toContain('related')
    expect(result).toContain('## Section A')
    expect(result).toContain('Body paragraph between blocks.')
    expect(result).toContain('Closing.')
  })

  test('leaves non-spec fenced blocks intact', () => {
    const input = [
      '```ts',
      'const x = 1',
      '```',
      '',
      '```spec',
      '{"op":"add","path":"/root","value":"r"}',
      '```'
    ].join('\n')

    const result = stripSpecBlocks(input)
    expect(result).toContain('```ts')
    expect(result).toContain('const x = 1')
    expect(result).not.toContain('```spec')
  })
})
