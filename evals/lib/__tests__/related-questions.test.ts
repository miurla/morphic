import { describe, expect, test } from 'vitest'

import { analyzeRelatedQuestions } from '../related-questions'

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

describe('analyzeRelatedQuestions', () => {
  test('accepts a well-formed block', () => {
    const result = analyzeRelatedQuestions(
      ANSWER + relatedBlock(THREE_QUESTIONS)
    )

    expect(result.emitted).toBe(true)
    expect(result.wellFormed).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.questions).toHaveLength(3)
  })

  test('reports no emission for a plain answer', () => {
    const result = analyzeRelatedQuestions(ANSWER)

    expect(result.emitted).toBe(false)
    expect(result.wellFormed).toBe(false)
    expect(result.issues).toEqual([])
  })

  test('flags a wrong question count', () => {
    const result = analyzeRelatedQuestions(
      ANSWER + relatedBlock(THREE_QUESTIONS.slice(0, 2))
    )

    expect(result.emitted).toBe(true)
    expect(result.wellFormed).toBe(false)
    expect(result.issues).toContain('2 buttons (expected 3)')
  })

  test('flags a query that does not match the button text', () => {
    const result = analyzeRelatedQuestions(
      ANSWER +
        relatedBlock([
          THREE_QUESTIONS[0],
          THREE_QUESTIONS[1],
          { text: 'What gear is required?', query: 'something else entirely' }
        ])
    )

    expect(result.wellFormed).toBe(false)
    expect(result.issues).toContain('button 3: query does not match text')
  })

  test('flags a non-submitQuery action', () => {
    const result = analyzeRelatedQuestions(
      ANSWER +
        relatedBlock([
          THREE_QUESTIONS[0],
          THREE_QUESTIONS[1],
          { text: 'What gear is required?', action: 'openUrl' }
        ])
    )

    expect(result.wellFormed).toBe(false)
    expect(result.issues).toContain('button 3: action is openUrl')
  })

  test('flags duplicate questions', () => {
    const result = analyzeRelatedQuestions(
      ANSWER +
        relatedBlock([
          THREE_QUESTIONS[0],
          THREE_QUESTIONS[0],
          THREE_QUESTIONS[1]
        ])
    )

    expect(result.wellFormed).toBe(false)
    expect(result.issues).toContain('duplicate questions')
  })

  test('does not count a malformed image block as an emission', () => {
    const brokenImage = [
      '```spec',
      '{"op":"add","path":"/root","value":"grid"}',
      '{"op":"add","path":"/elements/grid","value":{"type":"Grid","props":{"columns":2',
      '```'
    ].join('\n')

    const result = analyzeRelatedQuestions(ANSWER + brokenImage)

    expect(result.emitted).toBe(false)
    expect(result.issues).toEqual([])
  })

  test('counts a malformed related block as a broken emission', () => {
    const brokenRelated = [
      '```spec',
      '{"op":"add","path":"/root","value":"main"}',
      '{"op":"add","path":"/elements/header","value":{"type":"Heading","props":{"title":"Related"',
      '```'
    ].join('\n')

    const result = analyzeRelatedQuestions(ANSWER + brokenRelated)

    expect(result.emitted).toBe(true)
    expect(result.wellFormed).toBe(false)
    expect(result.issues).toContain('1 related block(s) failed to compile')
  })

  test('flags content that follows the related block', () => {
    const result = analyzeRelatedQuestions(
      `${ANSWER}${relatedBlock(THREE_QUESTIONS)}\n\nOne more thought.`
    )

    expect(result.emitted).toBe(true)
    expect(result.wellFormed).toBe(false)
    expect(
      result.issues.some(issue => issue.includes('follow the related block'))
    ).toBe(true)
  })

  test('allows trailing whitespace after the related block', () => {
    const result = analyzeRelatedQuestions(
      `${ANSWER}${relatedBlock(THREE_QUESTIONS)}\n\n  \n`
    )

    expect(result.wellFormed).toBe(true)
  })

  test('ignores an image spec block', () => {
    const imageBlock = [
      '```spec',
      '{"op":"add","path":"/root","value":"grid"}',
      '{"op":"add","path":"/elements/grid","value":{"type":"Grid","props":{"columns":2,"gap":"sm"},"children":["img1"]}}',
      '{"op":"add","path":"/elements/img1","value":{"type":"Image","props":{"src":"https://example.com/a.jpg","sourceUrl":"https://example.com","title":"Fuji","aspectRatio":"4:3"},"children":[]}}',
      '```'
    ].join('\n')

    const result = analyzeRelatedQuestions(
      `${ANSWER}${imageBlock}\n\n${relatedBlock(THREE_QUESTIONS)}`
    )

    expect(result.emitted).toBe(true)
    expect(result.wellFormed).toBe(true)
  })
})
