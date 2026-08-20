import { parseSpecBlock } from '@/lib/render/parse-spec-block'

// Structural view of a compiled spec element. The compiled catalog types are
// wider than what this check needs, and pinning the shape here keeps the
// evaluator honest about the contract it asserts.
type SpecElement = {
  type: string
  props?: Record<string, unknown>
  children?: string[]
  on?: {
    press?: {
      action?: string
      params?: Record<string, unknown>
    }
  }
}

type CompiledSpec = {
  /** Elements reachable from the root, in the order they render. */
  rendered: SpecElement[]
  /** Children of the root element, in order. Rule: the heading comes first. */
  topLevel: SpecElement[]
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

// Only elements reachable from the root render. Reading the element map
// directly would credit a block for buttons the user never sees, and would miss
// the required ordering entirely, since a map has no order to inspect.
function compileElements(source: string): CompiledSpec | null {
  let spec: ReturnType<typeof parseSpecBlock>
  try {
    spec = parseSpecBlock(source)
  } catch {
    return null
  }

  const elements = (spec.elements ?? {}) as Record<string, SpecElement>
  const root = elements[spec.root as string]
  if (!root) return { rendered: [], topLevel: [] }

  const rendered: SpecElement[] = []
  const seen = new Set<string>()

  const walk = (key: string) => {
    if (seen.has(key)) return
    seen.add(key)
    const element = elements[key]
    if (!element) return
    rendered.push(element)
    for (const child of element.children ?? []) walk(child)
  }
  walk(spec.root as string)

  const topLevel = (root.children ?? [])
    .map(key => elements[key])
    .filter((element): element is SpecElement => element !== undefined)

  return { rendered, topLevel }
}

function isRelatedBlock(spec: CompiledSpec): boolean {
  return spec.rendered.some(
    element => element.type === 'Heading' && element.props?.title === 'Related'
  )
}

function isRelatedHeading(element: SpecElement | undefined): boolean {
  return element?.type === 'Heading' && element.props?.title === 'Related'
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
    spec: compileElements(block.source)
  }))
  const relatedBlocks = parsedBlocks.filter(
    (block): block is (typeof parsedBlocks)[number] & { spec: CompiledSpec } =>
      block.spec !== null && isRelatedBlock(block.spec)
  )

  // A related block that fails to compile is an emission the user never sees.
  // Counting it as "not emitted" would hide the failure, so it is reported as a
  // malformed emission instead.
  const brokenRelatedCount = parsedBlocks.filter(
    block => block.spec === null && looksLikeRelatedSource(block.source)
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

  // "Always include a Heading with title Related as the first child element."
  const block = relatedBlocks[0].spec
  if (!isRelatedHeading(block.topLevel[0])) {
    issues.push('the Related heading is not the first child of the root')
  }

  const buttons = block.rendered.filter(element => element.type === 'Button')
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
