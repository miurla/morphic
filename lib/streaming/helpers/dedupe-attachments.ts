import type { UIMessage } from 'ai'

import {
  describeAttachment,
  type FilePartLike,
  isFilePart
} from './attachment-parts'

/**
 * Every identity a part answers to, strongest first.
 *
 * The R2 object key names one immutable object, so two parts sharing it are
 * certainly the same file. The url is the fallback for parts stored without a
 * key (data urls, external links).
 *
 * Name, media type and size together are a weaker claim: they are what the
 * upload path uses to narrow candidates before it settles the question with a
 * digest, so equal metadata is evidence of identical bytes rather than proof.
 *
 * A kept part registers all of them, and a later part is only matched against
 * the ones it is allowed to be judged on, so restricting the evidence for one
 * position never costs a match the stronger identities would have made.
 */
function attachmentIdentities(part: FilePartLike): {
  storage: string[]
  metadata: string[]
} {
  const storage: string[] = []
  if (part.key) storage.push(`key:${part.key}`)
  if (part.url) storage.push(`url:${part.url}`)

  const metadata =
    part.filename && part.mediaType && part.size !== undefined
      ? [`content:${part.filename}|${part.mediaType}|${part.size}`]
      : []

  return { storage, metadata }
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
 *
 * The newest user message is matched on storage identity only. Two different
 * files can share a name, a type and a byte length, and collapsing the request
 * being answered on that evidence would drop the very attachment the user is
 * asking about. A wrong guess about history costs one replay of something
 * already answered; a wrong guess about the current turn costs the answer.
 */
export function dedupeAttachments(messages: UIMessage[]): UIMessage[] {
  const seen = new Set<string>()
  const currentTurnIndex = messages.findLastIndex(
    message => message.role === 'user'
  )

  return messages.map((message, index) => {
    if (!message.parts.some(isFilePart)) return message

    const allowMetadata = index !== currentTurnIndex
    let replaced = false
    const parts = message.parts.map(part => {
      if (!isFilePart(part)) return part

      const file = part as FilePartLike
      const { storage, metadata } = attachmentIdentities(file)
      const all = [...storage, ...metadata]
      if (all.length === 0) return part

      const judgedOn = allowMetadata ? all : storage
      if (!judgedOn.some(identity => seen.has(identity))) {
        all.forEach(identity => seen.add(identity))
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
