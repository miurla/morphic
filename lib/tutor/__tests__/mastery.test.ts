import { describe, expect, it } from 'vitest'

import { calculateChapterMastery } from '../mastery'
import type { KnowledgePoint, TutorAssessment, TutorQuestion } from '../types'

const points: KnowledgePoint[] = [
  { id: 'a', title: 'A', sourceIds: [] },
  { id: 'b', title: 'B', sourceIds: [] }
]
const questions: TutorQuestion[] = [
  { id: 'q1', knowledgePointId: 'a', kind: 'concept', prompt: 'A?' },
  { id: 'q2', knowledgePointId: 'a', kind: 'practice', prompt: 'Apply A' },
  { id: 'q3', knowledgePointId: 'b', kind: 'concept', prompt: 'B?' }
]
function attempt(
  id: string,
  questionId: string,
  knowledgePointId: string,
  score: number,
  createdAt: string
): TutorAssessment {
  return {
    id,
    questionId,
    knowledgePointId,
    score,
    createdAt,
    answer: 'answer',
    feedback: 'feedback',
    strengths: [],
    improvements: [],
    criteria: [],
    sourceIds: []
  }
}
describe('chapter mastery', () => {
  it('counts untested concepts and practical exercises as unassessed', () => {
    expect(
      calculateChapterMastery(
        points,
        [attempt('1', 'q1', 'a', 100, '2026-01-01')],
        questions
      )
    ).toBe(25)
  })
  it('updates a question instead of accumulating retries and can reflect a lower latest result', () => {
    expect(
      calculateChapterMastery(
        points,
        [
          attempt('1', 'q1', 'a', 100, '2026-01-01'),
          attempt('2', 'q1', 'a', 40, '2026-01-02')
        ],
        questions
      )
    ).toBe(10)
  })
  it('ignores unknown or mismatched question evidence', () => {
    expect(
      calculateChapterMastery(
        points,
        [
          attempt('1', 'foreign', 'b', 100, '2026-01-01'),
          attempt('2', 'q1', 'b', 100, '2026-01-01')
        ],
        questions
      )
    ).toBe(0)
  })
  it('requires all questions for full mastery', () => {
    const attempts = questions.map((q, i) =>
      attempt(String(i), q.id, q.knowledgePointId, 100, '2026-01-01')
    )
    expect(calculateChapterMastery(points, attempts, questions)).toBe(100)
  })
})
