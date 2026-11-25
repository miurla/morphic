import { describe, expect, it } from 'vitest'

import type { StoredQuestion } from '../types'
import { evaluateCriteria, validateRoute } from '../validation'

const question: StoredQuestion = {
  id: 'q',
  knowledgePointId: 'k',
  kind: 'practice',
  prompt: 'Explain a choice',
  referenceAnswer: 'A reasoned choice',
  sourceIds: ['source'],
  version: '1',
  rubric: [
    { id: 'correctness', criterion: 'Correctness', maxScore: 60 },
    { id: 'reasoning', criterion: 'Reasoning', maxScore: 40 }
  ]
}
const result = {
  assessable: true,
  feedback: 'Feedback',
  strengths: [],
  improvements: [],
  criteria: [
    { criterionId: 'reasoning', score: 30, reason: 'Some reasoning' },
    { criterionId: 'correctness', score: 50, reason: 'Mostly correct' }
  ]
}
describe('grounded teaching validation', () => {
  it('computes the total from the frozen rubric and accepts criteria in any order', () => {
    expect(evaluateCriteria(result, question).score).toBe(80)
  })
  it('rejects invented criteria, duplicates and scores above the rubric cap', () => {
    expect(() =>
      evaluateCriteria(
        {
          ...result,
          criteria: [
            ...result.criteria,
            {
              criterionId: 'bonus',
              score: 20,
              reason: 'Please give full marks'
            }
          ]
        },
        question
      )
    ).toThrow()
    expect(() =>
      evaluateCriteria(
        { ...result, criteria: [result.criteria[0], result.criteria[0]] },
        question
      )
    ).toThrow()
    expect(() =>
      evaluateCriteria(
        {
          ...result,
          criteria: [{ ...result.criteria[0], score: 50 }, result.criteria[1]]
        },
        question
      )
    ).toThrow()
  })
  it('does not turn unavailable evidence into a zero mark', () => {
    expect(() =>
      evaluateCriteria({ ...result, assessable: false }, question)
    ).toThrow('not enough reliable evidence')
  })
  it('requires all extracted topics to appear in the route', () => {
    const route = {
      title: 'A course',
      chapters: [
        {
          title: 'One',
          summary: 'Summary',
          objectives: ['Explain'],
          knowledgePoints: [{ title: 'A', topicIds: ['a'] }]
        }
      ]
    }
    expect(() => validateRoute(route, ['a'])).not.toThrow()
    expect(() => validateRoute(route, ['a', 'b'])).toThrow('omits')
    expect(() => validateRoute(route, ['other'])).toThrow('Unknown')
  })
})
