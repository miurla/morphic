import type { Evaluation, Evaluator, RunEvaluator } from '@langfuse/client'

import { stripSpecBlocks } from '@/lib/render/strip-spec-blocks'

import type {
  RelatedQuestionsExpected,
  RelatedQuestionsInput,
  RelatedQuestionsMetadata
} from '../lib/dataset'
import { analyzeRelatedQuestions } from '../lib/related-questions'

// Mirrors the SDK's item result loosely: for a Langfuse dataset the metadata
// arrives as `unknown`, so the category is narrowed at read time.
type ItemResult = {
  output?: unknown
  metadata?: unknown
  item?: { metadata?: unknown }
}

type Category = RelatedQuestionsMetadata['category']

export type RelatedQuestionsSummary = {
  substantiveCount: number
  trivialCount: number
  /** Answers that carried a related block, the denominator of wellFormedRate. */
  emittedCount: number
  /** Share of substantive answers that carried a related block. */
  emissionRate: number
  /** Share of trivial answers that carried one anyway. */
  falsePositiveRate: number
  /** Share of emitted blocks that satisfy the spec contract. */
  wellFormedRate: number
}

function answerText(output: unknown): string {
  if (typeof output === 'string') return output
  if (output && typeof output === 'object' && 'text' in output) {
    const text = (output as { text?: unknown }).text
    if (typeof text === 'string') return text
  }
  return ''
}

function itemCategory(result: ItemResult): Category | undefined {
  const metadata = (result.metadata ?? result.item?.metadata) as
    | { category?: unknown }
    | undefined
  const category = metadata?.category
  return category === 'substantive' || category === 'trivial'
    ? category
    : undefined
}

/**
 * Score one answer.
 *
 * Emission and well-formedness are reported separately. A model that stopped
 * emitting and a model that emits a broken block need different fixes, and a
 * single "correct" score would not say which happened.
 */
export const relatedQuestionsEvaluator: Evaluator<
  RelatedQuestionsInput,
  RelatedQuestionsExpected,
  RelatedQuestionsMetadata
> = async ({ output, expectedOutput }) => {
  const answer = answerText(output)
  const analysis = analyzeRelatedQuestions(answer)
  const expected = expectedOutput?.emitsRelated ?? true

  const evaluations: Evaluation[] = [
    {
      name: 'related_questions_emitted',
      value: analysis.emitted ? 1 : 0,
      dataType: 'BOOLEAN',
      comment: analysis.emitted
        ? `${analysis.questions.length} question(s)`
        : 'no related block'
    },
    {
      name: 'related_questions_matches_expectation',
      value: analysis.emitted === expected ? 1 : 0,
      dataType: 'BOOLEAN',
      comment: `expected ${expected ? 'a block' : 'no block'}, got ${
        analysis.emitted ? 'a block' : 'none'
      }`
    }
  ]

  // The item label describes the question, while this records the answer.
  // They are only comparable when both values live on the same item. The spec
  // block is stripped first, otherwise emitting one lengthens the answer and
  // the value moves with the outcome it exists to be compared against.
  evaluations.push({
    name: 'related_questions_answer_chars',
    value: stripSpecBlocks(answer).length,
    dataType: 'NUMERIC'
  })

  // Well-formedness is undefined when nothing was emitted. Scoring it 0 there
  // would double-count the emission failure and drag the rate down for a
  // reason that has nothing to do with formatting.
  if (analysis.emitted) {
    evaluations.push({
      name: 'related_questions_wellformed',
      value: analysis.wellFormed ? 1 : 0,
      dataType: 'BOOLEAN',
      comment: analysis.wellFormed ? 'ok' : analysis.issues.join('; ')
    })
  }

  return evaluations
}

export function summarizeRelatedQuestions(
  itemResults: ItemResult[]
): RelatedQuestionsSummary {
  let substantiveCount = 0
  let trivialCount = 0
  let emitted = 0
  let falsePositives = 0
  let emittedTotal = 0
  let wellFormed = 0

  for (const result of itemResults) {
    const analysis = analyzeRelatedQuestions(answerText(result.output))
    const category = itemCategory(result)

    if (analysis.emitted) {
      emittedTotal++
      if (analysis.wellFormed) wellFormed++
    }

    if (category === 'substantive') {
      substantiveCount++
      if (analysis.emitted) emitted++
    } else if (category === 'trivial') {
      trivialCount++
      if (analysis.emitted) falsePositives++
    }
  }

  return {
    substantiveCount,
    trivialCount,
    emittedCount: emittedTotal,
    emissionRate: substantiveCount === 0 ? 0 : emitted / substantiveCount,
    falsePositiveRate: trivialCount === 0 ? 0 : falsePositives / trivialCount,
    wellFormedRate: emittedTotal === 0 ? 0 : wellFormed / emittedTotal
  }
}

export const relatedQuestionsRunEvaluator: RunEvaluator<
  RelatedQuestionsInput,
  RelatedQuestionsExpected,
  RelatedQuestionsMetadata
> = async ({ itemResults }) => {
  const summary = summarizeRelatedQuestions(itemResults as ItemResult[])

  return [
    {
      name: 'emission_rate',
      value: summary.emissionRate,
      dataType: 'NUMERIC',
      comment: `substantive items: ${summary.substantiveCount}`
    },
    {
      name: 'false_positive_rate',
      value: summary.falsePositiveRate,
      dataType: 'NUMERIC',
      comment: `trivial items: ${summary.trivialCount}`
    },
    {
      name: 'wellformed_rate',
      value: summary.wellFormedRate,
      dataType: 'NUMERIC'
    }
  ]
}
