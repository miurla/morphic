import type { UIMessage } from 'ai'

const DEFAULT_REPLAY_LIMIT = 10

/**
 * Only an explicit `0` disables the cap.
 *
 * Templated environments routinely define a variable as an empty string, and
 * `Number('')` is `0` — which would silently replay every attachment while
 * looking configured. Anything unusable falls back to the default instead, and
 * a positive value always keeps at least one attachment.
 */
export function parseReplayLimit(raw: string | undefined): number {
  const value = raw?.trim()
  if (!value) return DEFAULT_REPLAY_LIMIT

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_REPLAY_LIMIT

  return parsed === 0 ? 0 : Math.max(1, Math.floor(parsed))
}

export const HISTORY_ATTACHMENT_REPLAY_LIMIT = parseReplayLimit(
  process.env.HISTORY_ATTACHMENT_REPLAY_LIMIT
)

const MAX_FILENAME_CHARS = 80

function describeAttachment(part: { mediaType?: string; filename?: string }) {
  // The filename is user-supplied, so neutralize it the way source excerpts are
  // neutralized: no markup, no newlines, bounded length.
  const filename = (part.filename ?? '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILENAME_CHARS)
  const mediaType = (part.mediaType ?? 'file').replace(/[^\w.+/-]/g, '')

  return filename
    ? `"${filename}" (${mediaType})`
    : `an earlier ${mediaType} attachment`
}

/**
 * Number of leading attachments to drop, quantized to whole blocks of `limit`.
 *
 * A plain "keep the newest N" boundary moves by one on every turn that adds an
 * attachment, and because the boundary sits near the START of the conversation
 * it would rewrite the prompt prefix — and so drop the provider's cache for the
 * whole request — on exactly the long threads this is meant to make cheaper.
 *
 * Quantizing means the dropped set is identical for every turn between two
 * block crossings, so the prefix survives; the cache is only reset once per
 * `limit` new attachments. The cost of that is a looser bound: the number kept
 * lands anywhere in [limit, 2 * limit).
 */
function getDroppedCount(total: number, limit: number): number {
  if (total <= limit) return 0
  return Math.floor((total - limit) / limit) * limit
}

function isFilePart(part: UIMessage['parts'][number]) {
  return part.type === 'file'
}

/**
 * Caps how many of a conversation's attachments are replayed to the model.
 *
 * Attachments are re-sent on every turn, and an image costs thousands of input
 * tokens, so a thread that collects a few screenshots per turn ends up spending
 * most of its context re-reading pictures it already answered about. Older ones
 * become a text placeholder naming the file, which keeps the message valid when
 * it held nothing but attachments, and lets the model ask for a re-attach
 * instead of silently losing the reference. The file itself is untouched: it
 * stays stored and stays visible in the conversation.
 *
 * The newest user message is never capped — that is the request being answered.
 */
export function capHistoricalAttachments(
  messages: UIMessage[],
  limit: number = HISTORY_ATTACHMENT_REPLAY_LIMIT
): UIMessage[] {
  if (limit <= 0) return messages

  const currentTurnIndex = messages.findLastIndex(
    message => message.role === 'user'
  )
  const historyEnd =
    currentTurnIndex === -1 ? messages.length : currentTurnIndex

  let total = 0
  for (let i = 0; i < historyEnd; i++) {
    total += messages[i].parts.filter(isFilePart).length
  }

  const dropCount = getDroppedCount(total, limit)
  if (dropCount === 0) return messages

  let seen = 0
  return messages.map((message, index) => {
    if (index >= historyEnd || !message.parts.some(isFilePart)) {
      return message
    }

    const parts = message.parts.map(part => {
      if (!isFilePart(part)) return part

      seen += 1
      if (seen > dropCount) return part

      const file = part as { mediaType?: string; filename?: string }
      return {
        type: 'text' as const,
        text: `[Attachment omitted from history: ${describeAttachment(
          file
        )}. Ask the user to re-attach it if you need to look at it again.]`
      }
    })

    return { ...message, parts }
  })
}
