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

type SpecBlock = {
  source: string
  /** Offset just past the closing fence, used to check the end-of-answer rule. */
  end: number
}

function extractSpecBlocks(markdown: string): SpecBlock[] {
  const blocks: SpecBlock[] = []
  // The global regex is stateful, so it is constructed fresh per call.
  const pattern = new RegExp(SPEC_BLOCK_PATTERN.source, 'g')
  let match: RegExpExecArray | null
  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push({ source: match[1], end: match.index + match[0].length })
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

// A block that fails to compile has no elements to inspect, so its raw source is
// the only evidence of what it was meant to be. Image blocks are a separate and
// legitimate feature, so a broken one must not be counted as a related-question
// emission.
function looksLikeRelatedSource(source: string): boolean {
  return (
    /"title"\s*:\s*"Related"/.test(source) ||
    /"action"\s*:\s*"submitQuery"/.test(source)
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
  const parsedBlocks = extractSpecBlocks(markdown).map(block => ({
    ...block,
    elements: compileElements(block.source)
  }))
  const relatedBlocks = parsedBlocks.filter(
    (
      block
    ): block is (typeof parsedBlocks)[number] & {
      elements: SpecElement[]
    } => block.elements !== null && isRelatedBlock(block.elements)
  )

  // A related block that fails to compile is an emission the user never sees.
  // Counting it as "not emitted" would hide the failure, so it is reported as a
  // malformed emission instead.
  const brokenRelatedCount = parsedBlocks.filter(
    block => block.elements === null && looksLikeRelatedSource(block.source)
  ).length

  if (relatedBlocks.length === 0) {
    return brokenRelatedCount > 0
      ? {
          emitted: true,
          questions: [],
          wellFormed: false,
          issues: [`${brokenRelatedCount} related block(s) failed to compile`]
        }
      : { emitted: false, questions: [], wellFormed: false, issues: [] }
  }

  const issues: string[] = []
  if (relatedBlocks.length > 1) {
    issues.push(`${relatedBlocks.length} related blocks (expected 1)`)
  }
  if (brokenRelatedCount > 0) {
    issues.push(`${brokenRelatedCount} related block(s) failed to compile`)
  }

  // Rule 1 of the spec prompt: the related fence must close the response.
  // Anything after it is content the user sees below their follow-up buttons.
  const trailing = markdown.slice(relatedBlocks[0].end).trim()
  if (trailing !== '') {
    issues.push(
      `${trailing.length} char(s) of content follow the related block`
    )
  }

  const buttons = relatedBlocks[0].elements.filter(
    element => element.type === 'Button'
  )
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
