import type { KnowledgePoint, TutorAssessment, TutorQuestion } from './types'

/** Latest result per question; every published question counts, including untested ones. */
export function calculateChapterMastery(
  points: KnowledgePoint[],
  attempts: TutorAssessment[],
  questions: TutorQuestion[]
): number {
  if (!points.length || !questions.length) return 0
  const allowed = new Map(questions.map(question => [question.id, question]))
  const latest = new Map<string, TutorAssessment>()
  for (const attempt of attempts) {
    const question = allowed.get(attempt.questionId)
    if (
      !question ||
      question.knowledgePointId !== attempt.knowledgePointId ||
      !Number.isFinite(attempt.score)
    )
      continue
    const previous = latest.get(attempt.questionId)
    if (
      !previous ||
      attempt.createdAt > previous.createdAt ||
      (attempt.createdAt === previous.createdAt && attempt.id > previous.id)
    )
      latest.set(attempt.questionId, attempt)
  }
  const total = points.reduce((sum, point) => {
    const pointQuestions = questions.filter(
      question => question.knowledgePointId === point.id
    )
    if (!pointQuestions.length) return sum
    const score =
      pointQuestions.reduce(
        (subtotal, question) =>
          subtotal +
          Math.max(0, Math.min(100, latest.get(question.id)?.score ?? 0)),
        0
      ) / pointQuestions.length
    return sum + score
  }, 0)
  return Math.round(total / points.length)
}
