import type { UIMessage } from 'ai'

import {
  describeAttachment,
  type FilePartLike,
  isFilePart
} from './attachment-parts'

/**
 * Identity of the stored bytes, or undefined when the part carries nothing that
 * identifies them.
 *
 * Name, media type and size together identify byte-identical uploads even when
 * they were stored under different keys. This is safe where filename alone was
 * not: equal keys already imply equal content identity, so this only merges
 * more copies with the same name, type and byte length. The object key and url
 * remain fallbacks when size metadata is unavailable.
 */
function attachmentIdentity(part: FilePartLike): string | undefined {
  if (part.filename && part.mediaType && part.size !== undefined) {
    return `content:${part.filename}|${part.mediaType}|${part.size}`
  }
  if (part.key) return `key:${part.key}`
  if (part.url) return `url:${part.url}`
  return undefined
}

/**
 * Sends a file to the model once, however many times it was attached.
 *
 * The same file lands in a conversation twice more often than it sounds: the
 * usual path is a user re-attaching something because the first copy went
 * unmentioned in the reply. Every copy is then replayed on every later turn,
 * and a single PDF can be several hundred thousand tokens, so one accidental
 * duplicate roughly doubles the input of the rest of the thread for no added
 * information.
 *
 * The first occurrence is the one kept, so the decision for any given part
 * depends only on the parts before it: appending turns never rewrites the
 * prompt prefix, and the provider cache survives.
 *
 * This is not `capHistoricalAttachments`. That one bounds the attachment count
 * and drops the oldest; duplicates can sit far below its cap and still dominate
 * the payload. Run it first, so an attachment it already turned into a
 * placeholder cannot swallow the copy the user just re-attached.
 */
export function dedupeAttachments(messages: UIMessage[]): UIMessage[] {
  const seen = new Set<string>()

  return messages.map(message => {
    if (!message.parts.some(isFilePart)) return message

    let replaced = false
    const parts = message.parts.map(part => {
      if (!isFilePart(part)) return part

      const file = part as FilePartLike
      const identity = attachmentIdentity(file)
      if (!identity) return part

      if (!seen.has(identity)) {
        seen.add(identity)
        return part
      }

      replaced = true
      return {
        type: 'text' as const,
        text: `[Duplicate attachment omitted: ${describeAttachment(
          file
        )} is already attached earlier in this conversation.]`
      }
    })

    return replaced ? { ...message, parts } : message
  })
}
