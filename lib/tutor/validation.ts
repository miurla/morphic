import { z } from 'zod'

import { assertCitationIds } from './citations'
import { TutorError } from './errors'
import { assessmentSchema, lessonSchema, routeSchema } from './generation'
import type { KnowledgePoint, RetrievedChunk, StoredQuestion } from './types'

export function validateRoute(
  value: z.infer<typeof routeSchema>,
  topicIds: string[]
) {
  const available = new Set(topicIds)
  const covered = new Set<string>()
  for (const chapter of value.chapters) {
    for (const point of chapter.knowledgePoints) {
      for (const id of point.topicIds) {
        if (!available.has(id)) throw new Error('Unknown curriculum topic')
        covered.add(id)
      }
    }
  }
  if (covered.size !== available.size)
    throw new Error('The route omits source topics')
}

export function validateLesson(
  value: z.infer<typeof lessonSchema>,
  points: KnowledgePoint[],
  evidence: RetrievedChunk[]
) {
  const pointIds = new Set(points.map(point => point.id))
  for (const item of [
    ...value.concepts,
    ...value.examples,
    ...value.questions
  ]) {
    if (!pointIds.has(item.knowledgePointId))
      throw new Error('Unknown knowledge point')
    assertCitationIds(item.sourceIds, evidence)
  }
  for (const point of points) {
    if (
      !value.concepts.some(item => item.knowledgePointId === point.id) ||
      !value.examples.some(item => item.knowledgePointId === point.id)
    )
      throw new Error('Missing concept or worked example')
    for (const kind of ['concept', 'practice'] as const) {
      if (
        value.questions.filter(
          question =>
            question.knowledgePointId === point.id && question.kind === kind
        ).length !== 1
      )
        throw new Error(
          'Each point needs one conceptual and one practical question'
        )
    }
  }
  for (const question of value.questions) {
    if (
      question.rubric.reduce((sum, item) => sum + item.maxScore, 0) !== 100 ||
      new Set(question.rubric.map(item => item.id)).size !==
        question.rubric.length
    )
      throw new Error('Invalid scoring rubric')
  }
}

export function evaluateCriteria(
  value: z.infer<typeof assessmentSchema>,
  question: StoredQuestion
) {
  if (!value.assessable)
    throw new TutorError(
      'There is not enough reliable evidence to grade this answer. Your mastery has not changed.',
      'INSUFFICIENT_EVIDENCE',
      422
    )
  const returned = new Map(
    value.criteria.map(criterion => [criterion.criterionId, criterion])
  )
  if (
    returned.size !== value.criteria.length ||
    returned.size !== question.rubric.length
  )
    throw new Error('Invalid grading criteria')
  const criteria = question.rubric.map(criterion => {
    const result = returned.get(criterion.id)
    if (
      !result ||
      result.score < 0 ||
      result.score > criterion.maxScore ||
      !Number.isFinite(result.score)
    )
      throw new Error('Invalid criterion score')
    return {
      criterion: criterion.criterion,
      score: result.score,
      maxScore: criterion.maxScore,
      reason: result.reason
    }
  })
  return {
    criteria,
    score: Math.round(
      criteria.reduce((total, criterion) => total + criterion.score, 0)
    )
  }
}
