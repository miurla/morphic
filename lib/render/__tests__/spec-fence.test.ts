import { describe, expect, test } from 'vitest'

import { createSpecFenceEvaluator } from '../spec-fence'

describe('createSpecFenceEvaluator', () => {
  test('returns pending for empty source', () => {
    const evaluator = createSpecFenceEvaluator()

    expect(evaluator.evaluate('')).toEqual({
      status: 'pending',
      source: ''
    })
  })

  test('returns ready for partial spec with valid patches', () => {
    const evaluator = createSpecFenceEvaluator()
    const source = [
      '{"op":"add","path":"/root","value":"main"}',
      '{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"sm"},"children":[]}}'
    ].join('\n')

    const result = evaluator.evaluate(source)

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.spec.root).toBe('main')
      expect(result.spec.elements['main'].type).toBe('Stack')
    }
  })

  test('returns ready for complete valid spec', () => {
    const evaluator = createSpecFenceEvaluator()
    const source = [
      '{"op":"add","path":"/root","value":"main"}',
      '{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"sm"},"children":["q1"]}}',
      '{"op":"add","path":"/elements/q1","value":{"type":"QuestionButton","props":{"text":"Follow up?"},"on":{"press":{"action":"submitQuery","params":{"query":"Follow up?"}}},"children":[]}}'
    ].join('\n')

    const result = evaluator.evaluate(source)

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.spec.root).toBe('main')
      expect(result.spec.elements['q1'].type).toBe('QuestionButton')
    }
  })

  test('returns ready with pruned children for dangling references', () => {
    const evaluator = createSpecFenceEvaluator()
    const source = [
      '{"op":"add","path":"/root","value":"main"}',
      '{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{},"children":["missing"]}}'
    ].join('\n')

    const result = evaluator.evaluate(source)

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.spec.elements['main'].children).toEqual([])
    }
  })

  test('handles incremental streaming correctly', () => {
    const evaluator = createSpecFenceEvaluator()

    // First chunk: just root
    const result1 = evaluator.evaluate(
      '{"op":"add","path":"/root","value":"main"}'
    )
    expect(result1.status).toBe('ready')

    // Second chunk: add element
    const source2 = [
      '{"op":"add","path":"/root","value":"main"}',
      '{"op":"add","path":"/elements/main","value":{"type":"QuestionButton","props":{"text":"Test"},"children":[]}}'
    ].join('\n')
    const result2 = evaluator.evaluate(source2)
    expect(result2.status).toBe('ready')
    if (result2.status === 'ready') {
      expect(result2.spec.elements['main'].type).toBe('QuestionButton')
    }
  })

  test('resets evaluator state', () => {
    const evaluator = createSpecFenceEvaluator()
    evaluator.evaluate('{"op":"add","path":"/root","value":"main"}')

    evaluator.reset()

    expect(evaluator.evaluate('')).toEqual({
      status: 'pending',
      source: ''
    })
  })
})
