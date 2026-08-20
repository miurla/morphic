import { describe, expect, test } from 'vitest'

import { relatedQuestionsEvaluator } from '../related-questions'

function relatedBlock(
  questions: Array<{ text: string; query?: string; action?: string }>
): string {
  const ids = questions.map((_, index) => `q${index + 1}`)
  const lines = [
    '{"op":"add","path":"/root","value":"main"}',
    `{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"children":["header","questions"]}}`,
    '{"op":"add","path":"/elements/header","value":{"type":"Heading","props":{"title":"Related","icon":"related"},"children":[]}}',
    `{"op":"add","path":"/elements/questions","value":{"type":"Stack","props":{"direction":"vertical","gap":"xs"},"children":${JSON.stringify(ids)}}}`,
    ...questions.map((question, index) => {
      const value = {
        type: 'Button',
        props: {
          text: question.text,
          variant: 'link',
          icon: 'arrow-right'
        },
        on: {
          press: {
            action: question.action ?? 'submitQuery',
            params: { query: question.query ?? question.text }
          }
        },
        children: []
      }
      return `{"op":"add","path":"/elements/${ids[index]}","value":${JSON.stringify(value)}}`
    })
  ]

  return ['```spec', ...lines, '```'].join('\n')
}

const THREE_QUESTIONS = [
  { text: 'Which Fuji route suits a first-time climber?' },
  { text: 'How do hut reservations work in peak season?' },
  { text: 'What gear is required above the 8th station?' }
]

const ANSWER = 'Mount Fuji has four main climbing routes.\n\n'

// The prose alone, so both cases below can assert the same value: emitting a
// block must not lengthen what is recorded.
const ANSWER_CHARS = 'Mount Fuji has four main climbing routes.'.length

async function evaluate(output: unknown, emitsRelated: boolean) {
  const result = await relatedQuestionsEvaluator({
    input: { query: 'How tall is Mount Fuji?', results: [] },
    output,
    expectedOutput: { emitsRelated }
  })

  return Array.isArray(result) ? result : [result]
}

describe('relatedQuestionsEvaluator', () => {
  test('records answer length without a related block', async () => {
    const evaluations = await evaluate(ANSWER, false)

    expect(evaluations).toEqual([
      {
        name: 'related_questions_emitted',
        value: 0,
        dataType: 'BOOLEAN',
        comment: 'no related block'
      },
      {
        name: 'related_questions_matches_expectation',
        value: 1,
        dataType: 'BOOLEAN',
        comment: 'expected no block, got none'
      },
      {
        name: 'related_questions_answer_chars',
        value: ANSWER_CHARS,
        dataType: 'NUMERIC'
      }
    ])
  })

  test('records answer length and keeps well-formedness with a related block', async () => {
    const output = ANSWER + relatedBlock(THREE_QUESTIONS)
    const evaluations = await evaluate(output, true)

    expect(evaluations).toEqual([
      {
        name: 'related_questions_emitted',
        value: 1,
        dataType: 'BOOLEAN',
        comment: '3 question(s)'
      },
      {
        name: 'related_questions_matches_expectation',
        value: 1,
        dataType: 'BOOLEAN',
        comment: 'expected a block, got a block'
      },
      {
        name: 'related_questions_answer_chars',
        value: ANSWER_CHARS,
        dataType: 'NUMERIC'
      },
      {
        name: 'related_questions_wellformed',
        value: 1,
        dataType: 'BOOLEAN',
        comment: 'ok'
      }
    ])
  })

  test('records zero when the output has no readable answer text', async () => {
    const evaluations = await evaluate(undefined, false)

    expect(evaluations).toContainEqual({
      name: 'related_questions_answer_chars',
      value: 0,
      dataType: 'NUMERIC'
    })
    expect(evaluations.map(evaluation => evaluation.name)).not.toContain(
      'related_questions_wellformed'
    )
  })
})
