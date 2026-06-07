import { parseSpecBlock } from '@/lib/render/parse-spec-block'

const SPEC_FENCE = /```spec\s*\n([\s\S]*?)```/g

export interface GenuiSummary {
  /** Number of spec fences in the message. */
  blockCount: number
  /** Spec blocks that are not the related-questions block. */
  contentBlockCount: number
  imageCount: number
  hasImage: boolean
  hasRelated: boolean
  /** Distinct element types across content blocks. */
  componentTypes: string[]
}

/**
 * Summarize the GenUI rendered in a finished assistant message.
 * A block containing Button elements is treated as the related-questions
 * block (tracked separately via clicks) and excluded from content metrics.
 * Returns null when the message contains no spec blocks.
 */
export function summarizeGenui(text: string): GenuiSummary | null {
  const sources: string[] = []
  SPEC_FENCE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = SPEC_FENCE.exec(text)) !== null) {
    sources.push(match[1])
  }
  if (sources.length === 0) return null

  let contentBlockCount = 0
  let imageCount = 0
  let hasRelated = false
  const componentTypes = new Set<string>()

  for (const source of sources) {
    let types: string[]
    try {
      types = Object.values(parseSpecBlock(source).elements).map(el => el.type)
    } catch {
      continue
    }

    if (types.includes('Button')) {
      hasRelated = true
      continue
    }

    contentBlockCount++
    for (const type of types) {
      componentTypes.add(type)
      if (type === 'Image') imageCount++
    }
  }

  return {
    blockCount: sources.length,
    contentBlockCount,
    imageCount,
    hasImage: imageCount > 0,
    hasRelated,
    componentTypes: Array.from(componentTypes)
  }
}
