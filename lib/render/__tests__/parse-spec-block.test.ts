import { describe, expect, test } from 'vitest'

import { createPartialSpecParser, parseSpecBlock } from '../parse-spec-block'

// Helper to build JSONL source for related questions spec
function buildRelatedQuestionsSource(questions: string[]): string {
  const lines = [
    '{"op":"add","path":"/root","value":"main"}',
    `{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"children":[${questions.map((_, i) => `"q${i + 1}"`).join(',')}]}}`
  ]
  questions.forEach((q, i) => {
    lines.push(
      `{"op":"add","path":"/elements/q${i + 1}","value":{"type":"Button","props":{"text":"${q}","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"${q}"}}},"children":[]}}`
    )
  })
  return lines.join('\n')
}

describe('createPartialSpecParser', () => {
  test('returns null for empty source', () => {
    const parser = createPartialSpecParser()
    expect(parser.parse('')).toBeNull()
    expect(parser.parse('   ')).toBeNull()
  })

  test('parses a single root patch', () => {
    const parser = createPartialSpecParser()
    const source = '{"op":"add","path":"/root","value":"main"}'
    const result = parser.parse(source)

    expect(result).not.toBeNull()
    expect(result!.root).toBe('main')
  })

  test('incrementally parses streamed content', () => {
    const parser = createPartialSpecParser()

    const line1 = '{"op":"add","path":"/root","value":"main"}'
    const result1 = parser.parse(line1)
    expect(result1).not.toBeNull()
    expect(result1!.root).toBe('main')
    expect(Object.keys(result1!.elements)).toHaveLength(0)

    const line2 =
      '\n{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"sm"},"children":[]}}'
    const result2 = parser.parse(line1 + line2)
    expect(result2).not.toBeNull()
    expect(result2!.elements['main']).toBeDefined()
    expect(result2!.elements['main'].type).toBe('Stack')
  })

  test('prunes references to missing children', () => {
    const parser = createPartialSpecParser()
    const source = [
      '{"op":"add","path":"/root","value":"main"}',
      '{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{},"children":["q1","q2"]}}'
      // q1 and q2 are not defined yet
    ].join('\n')

    const result = parser.parse(source)
    expect(result).not.toBeNull()
    // Children referencing missing elements should be pruned
    expect(result!.elements['main'].children).toEqual([])
  })

  test('returns cached result for same source', () => {
    const parser = createPartialSpecParser()
    const source = '{"op":"add","path":"/root","value":"main"}'

    const result1 = parser.parse(source)
    const result2 = parser.parse(source)
    expect(result1).toEqual(result2)
  })

  test('resets state', () => {
    const parser = createPartialSpecParser()
    const source = '{"op":"add","path":"/root","value":"main"}'
    parser.parse(source)

    parser.reset()
    expect(parser.parse('')).toBeNull()
  })
})

describe('parseSpecBlock', () => {
  test('parses a valid complete related questions spec', () => {
    const source = buildRelatedQuestionsSource([
      'Question 1',
      'Question 2',
      'Question 3'
    ])

    const spec = parseSpecBlock(source)
    expect(spec.root).toBe('main')
    expect(Object.keys(spec.elements)).toHaveLength(4) // main + q1 + q2 + q3
    expect(spec.elements['q1'].type).toBe('Button')
    expect(spec.elements['q1'].props).toMatchObject({
      text: 'Question 1',
      variant: 'link',
      icon: 'arrow-right'
    })
  })

  test('throws for invalid component types', () => {
    const source = [
      '{"op":"add","path":"/root","value":"main"}',
      '{"op":"add","path":"/elements/main","value":{"type":"InvalidComponent","props":{},"children":[]}}'
    ].join('\n')

    expect(() => parseSpecBlock(source)).toThrow()
  })

  test('throws for dangling child references', () => {
    const source = [
      '{"op":"add","path":"/root","value":"main"}',
      '{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{},"children":["missing"]}}'
    ].join('\n')

    expect(() => parseSpecBlock(source)).toThrow()
  })

  test('parses a Grid image group with Image children', () => {
    const source = [
      '{"op":"add","path":"/root","value":"grid"}',
      '{"op":"add","path":"/elements/grid","value":{"type":"Grid","props":{"columns":2,"gap":"sm"},"children":["img1","img2"]}}',
      '{"op":"add","path":"/elements/img1","value":{"type":"Image","props":{"src":"https://example.com/a.jpg","title":"A","description":"Alpha","aspectRatio":"4:3"},"children":[]}}',
      '{"op":"add","path":"/elements/img2","value":{"type":"Image","props":{"src":"https://example.com/b.jpg","title":"B","aspectRatio":"4:3"},"children":[]}}'
    ].join('\n')

    const spec = parseSpecBlock(source)
    expect(spec.root).toBe('grid')
    expect(spec.elements['grid'].type).toBe('Grid')
    expect(spec.elements['grid'].props).toMatchObject({
      columns: 2,
      gap: 'sm'
    })
    expect(spec.elements['img1'].type).toBe('Image')
    expect(spec.elements['img1'].props).toMatchObject({
      src: 'https://example.com/a.jpg',
      title: 'A',
      description: 'Alpha',
      aspectRatio: '4:3'
    })
    expect(spec.elements['img2'].props).toMatchObject({
      src: 'https://example.com/b.jpg',
      title: 'B',
      aspectRatio: '4:3'
    })
  })
})
