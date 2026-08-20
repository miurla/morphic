import type { UIMessage } from 'ai'

import { getTextFromParts } from '../../utils/message-utils'

import {
  describeAttachment,
  isFilePart,
  neutralizeLabel
} from './attachment-parts'

const MAX_NOTE_TITLE_CHARS = 80

function getDataText(data: unknown, key: string): string {
  const value = (data as Record<string, unknown> | undefined)?.[key]
  return typeof value === 'string' ? value : ''
}

/**
 * Describes one structured part by kind and weight, never by content: a pasted
 * block runs to tens of thousands of characters, and the content itself already
 * reaches the child generations. A URL is short and is itself the input, so it
 * is kept verbatim.
 */
function describePart(part: UIMessage['parts'][number]): string | undefined {
  if (isFilePart(part)) {
    return describeAttachment(part as { mediaType?: string; filename?: string })
  }

  const data = (part as { data?: unknown }).data

  if (part.type === 'data-pastedContent') {
    const text = getDataText(data, 'text')
    return text ? `pasted content (${text.length} characters)` : undefined
  }

  if (part.type === 'data-quotedContext') {
    const text = getDataText(data, 'text')
    return text ? `quoted context (${text.length} characters)` : undefined
  }

  if (part.type === 'data-noteContext') {
    const text = getDataText(data, 'text')
    if (!text) return undefined
    const title = neutralizeLabel(
      getDataText(data, 'title'),
      MAX_NOTE_TITLE_CHARS
    )
    const label = title ? `note "${title}"` : 'note'
    return `${label} (${text.length} characters)`
  }

  if (part.type === 'data-sourceUrl') {
    const url = getDataText(data, 'url')
    return url ? `URL card: ${url}` : undefined
  }

  return undefined
}

/**
 * The turn's input as recorded on the root observation.
 *
 * Typed text is the input whenever there is any. A turn can carry nothing but
 * structured parts, and dropping those would leave the trace with no input at
 * all, so they are summarized instead. A message that carries nothing usable
 * stays unset rather than recording an empty input.
 */
export function describeTurnInput(
  parts?: UIMessage['parts']
): string | undefined {
  const text = getTextFromParts(parts)
  if (text.trim()) return text

  const described = (parts ?? [])
    .map(describePart)
    .filter((description): description is string => Boolean(description))

  return described.length > 0 ? described.join(', ') : undefined
}
