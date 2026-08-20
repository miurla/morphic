import type { UIMessage } from 'ai'

const MAX_FILENAME_CHARS = 80

export type FilePartLike = {
  mediaType?: string
  filename?: string
  url?: string
  key?: string
  size?: number
}

export function isFilePart(part: UIMessage['parts'][number]) {
  return part.type === 'file'
}

/**
 * Renders a user-supplied label the way source excerpts are neutralized: no
 * markup, no newlines, bounded length.
 */
export function neutralizeLabel(value: string | undefined, maxChars: number) {
  return (value ?? '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
}

export function describeAttachment(part: FilePartLike) {
  const filename = neutralizeLabel(part.filename, MAX_FILENAME_CHARS)
  const mediaType = (part.mediaType ?? 'file').replace(/[^\w.+/-]/g, '')

  return filename
    ? `"${filename}" (${mediaType})`
    : `an earlier ${mediaType} attachment`
}
