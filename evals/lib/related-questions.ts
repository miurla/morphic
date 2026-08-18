import { parseSpecBlock } from '@/lib/render/parse-spec-block'

// Structural view of a compiled spec element. The compiled catalog types are
// wider than what this check needs, and pinning the shape here keeps the
// evaluator honest about the contract it asserts.
type SpecElement = {
  type: string
  props?: Record<string, unknown>
  on?: {
    press?: {
      action?: string
      params?: Record<string, unknown>
    }
  }
}

export type RelatedQuestionsAnalysis = {
  /** A spec block carrying a "Related" heading was present. */
  emitted: boolean
  /** Question text of every Button in the first related block, in order. */
  questions: string[]
  /** The block satisfies the contract the prompt asks for. */
  wellFormed: boolean
  /** Human-readable reasons wellFormed is false. Empty when it is true. */
  issues: string[]
}

const SPEC_BLOCK_PATTERN = /```spec\n([\s\S]*?)```/g

const EXPECTED_QUESTION_COUNT = 3

function extractSpecBlocks(markdown: string): string[] {
  const blocks: string[] = []
  // The global regex is stateful, so it is constructed fresh per call.
  const pattern = new RegExp(SPEC_BLOCK_PATTERN.source, 'g')
  let match: RegExpExecArray | null
  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push(match[1])
  }
  return blocks
}

function compileElements(source: string): SpecElement[] | null {
  try {
    const spec = parseSpecBlock(source)
    return Object.values(spec.elements ?? {}) as SpecElement[]
  } catch {
    return null
  }
}

function isRelatedBlock(elements: SpecElement[]): boolean {
  return elements.some(
    element => element.type === 'Heading' && element.props?.title === 'Related'
  )
}

/**
 * Inspect a model answer for the related questions spec block.
 *
 * Emission is deliberately separated from well-formedness: a model that stops
 * emitting the block and a model that emits a malformed one are different
 * failures with different fixes, and collapsing them into one pass/fail hides
 * which one happened.
 */
export function analyzeRelatedQuestions(
  markdown: string
): RelatedQuestionsAnalysis {
  const parsedBlocks = extractSpecBlocks(markdown).map(compileElements)
  const relatedBlocks = parsedBlocks.filter(
    (elements): elements is SpecElement[] =>
      elements !== null && isRelatedBlock(elements)
  )

  // A block that carries a "Related" heading but fails to compile is an
  // emission the user never sees. Counting it as "not emitted" would hide the
  // failure, so it is reported as a malformed emission instead.
  const unparseableCount = parsedBlocks.filter(
    elements => elements === null
  ).length

  if (relatedBlocks.length === 0) {
    return unparseableCount > 0
      ? {
          emitted: true,
          questions: [],
          wellFormed: false,
          issues: [`${unparseableCount} spec block(s) failed to compile`]
        }
      : { emitted: false, questions: [], wellFormed: false, issues: [] }
  }

  const issues: string[] = []
  if (relatedBlocks.length > 1) {
    issues.push(`${relatedBlocks.length} related blocks (expected 1)`)
  }
  if (unparseableCount > 0) {
    issues.push(`${unparseableCount} spec block(s) failed to compile`)
  }

  const buttons = relatedBlocks[0].filter(element => element.type === 'Button')
  if (buttons.length !== EXPECTED_QUESTION_COUNT) {
    issues.push(
      `${buttons.length} buttons (expected ${EXPECTED_QUESTION_COUNT})`
    )
  }

  const questions: string[] = []
  buttons.forEach((button, index) => {
    const text = button.props?.text
    const action = button.on?.press?.action
    const query = button.on?.press?.params?.query

    if (typeof text !== 'string' || text.trim() === '') {
      issues.push(`button ${index + 1}: missing text`)
    } else {
      questions.push(text)
    }

    if (action !== 'submitQuery') {
      issues.push(`button ${index + 1}: action is ${String(action)}`)
    }

    // Rule 4 of the spec prompt. A mismatch sends the user a different query
    // than the one they tapped.
    if (typeof text === 'string' && query !== text) {
      issues.push(`button ${index + 1}: query does not match text`)
    }
  })

  if (new Set(questions).size !== questions.length) {
    issues.push('duplicate questions')
  }

  return {
    emitted: true,
    questions,
    wellFormed: issues.length === 0,
    issues
  }
}
