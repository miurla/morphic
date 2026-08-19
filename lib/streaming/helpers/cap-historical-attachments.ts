import type { UIMessage } from 'ai'

import { estimateAttachmentTokens } from '@/lib/utils/attachment-tokens'

import { describeAttachment, isFilePart } from './attachment-parts'

const DEFAULT_REPLAY_LIMIT = 10
const DEFAULT_ATTACHMENT_TOKEN_BUDGET = 200_000
const MIN_WEIGHT_BLOCK_ATTACHMENTS = 2

/**
 * Only an explicit `0` disables the count cap. The weight budget below is a
 * separate knob and keeps applying.
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

export function parseAttachmentTokenBudget(raw: string | undefined): number {
  const value = raw?.trim()
  if (!value) return DEFAULT_ATTACHMENT_TOKEN_BUDGET

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_ATTACHMENT_TOKEN_BUDGET
  }

  return parsed === 0 ? 0 : Math.max(1, Math.floor(parsed))
}

export const HISTORY_ATTACHMENT_TOKEN_BUDGET = parseAttachmentTokenBudget(
  process.env.HISTORY_ATTACHMENT_TOKEN_BUDGET
)

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

/**
 * Number of leading attachments to drop, quantized by cumulative token weight.
 *
 * Blocks are anchored to the start of the surviving history and complete once
 * they reach `tokenBudget`, with at least two attachments per block. The
 * minimum is the stability bound: even an attachment heavier than the entire
 * budget cannot make the boundary advance on consecutive turns. We retain the
 * newest complete block plus any incomplete tail, so appending an attachment
 * cannot move the boundary until it completes another block.
 *
 * This deliberately permits nearly two blocks of replayed weight. A block can
 * exceed the budget by its final attachment, or more when an attachment alone
 * exceeds the budget. That overshoot is the cost of prefix stability while
 * guaranteeing that at least one historical attachment always survives.
 */
function getWeightDroppedCount(weights: number[], tokenBudget: number): number {
  let blockTokens = 0
  let blockAttachmentCount = 0
  let latestBlockEnd = 0
  let droppedCount = 0

  for (let i = 0; i < weights.length; i++) {
    blockTokens += weights[i]
    blockAttachmentCount += 1
    if (
      blockTokens < tokenBudget ||
      blockAttachmentCount < MIN_WEIGHT_BLOCK_ATTACHMENTS
    ) {
      continue
    }

    droppedCount = latestBlockEnd
    latestBlockEnd = i + 1
    blockTokens = 0
    blockAttachmentCount = 0
  }

  return droppedCount
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
  limit: number = HISTORY_ATTACHMENT_REPLAY_LIMIT,
  tokenBudget: number = HISTORY_ATTACHMENT_TOKEN_BUDGET
): UIMessage[] {
  if (limit <= 0 && tokenBudget <= 0) return messages

  const currentTurnIndex = messages.findLastIndex(
    message => message.role === 'user'
  )
  const historyEnd =
    currentTurnIndex === -1 ? messages.length : currentTurnIndex

  let total = 0
  for (let i = 0; i < historyEnd; i++) {
    total += messages[i].parts.filter(isFilePart).length
  }

  const countDropCount = limit > 0 ? getDroppedCount(total, limit) : 0
  const survivingWeights: number[] = []
  let seenForBudget = 0

  for (let i = 0; i < historyEnd; i++) {
    for (const part of messages[i].parts) {
      if (!isFilePart(part)) continue

      seenForBudget += 1
      if (seenForBudget <= countDropCount) continue

      const file = part as {
        mediaType?: string
        size?: number
      }
      survivingWeights.push(estimateAttachmentTokens(file))
    }
  }

  const weightDropCount =
    tokenBudget > 0 ? getWeightDroppedCount(survivingWeights, tokenBudget) : 0

  const dropCount = countDropCount + weightDropCount
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
