import type { UIMessage } from 'ai'

import { getWeightDroppedCount } from './cap-historical-attachments'
import { isSourceContextMessage } from './compact-historical-messages'

const DEFAULT_PASTED_CONTENT_CHAR_BUDGET = 200_000

export function parsePastedContentCharBudget(raw: string | undefined): number {
  const value = raw?.trim()
  if (!value) return DEFAULT_PASTED_CONTENT_CHAR_BUDGET

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_PASTED_CONTENT_CHAR_BUDGET
  }

  return parsed === 0 ? 0 : Math.max(1, Math.floor(parsed))
}

export const HISTORY_PASTED_CONTENT_CHAR_BUDGET = parsePastedContentCharBudget(
  process.env.HISTORY_PASTED_CONTENT_CHAR_BUDGET
)

function getPastedLength(part: UIMessage['parts'][number]): number {
  if (part.type !== 'data-pastedContent') return 0

  const text = (part as { data?: { text?: unknown } }).data?.text
  return typeof text === 'string' ? text.length : 0
}

/**
 * Caps how much pasted content from earlier turns is replayed to the model.
 *
 * Older blocks become a text placeholder giving their size. They are dropped
 * by the same weight quantization as attachments, so the prompt prefix stays
 * cacheable between block crossings. A block may be a single paste: when one
 * paste exceeds the budget, moving the boundary on each new paste rewrites far
 * less than carrying a second copy would. The newest user message and the
 * newest historical paste are never capped.
 */
export function capHistoricalPastedContent(
  messages: UIMessage[],
  charBudget: number = HISTORY_PASTED_CONTENT_CHAR_BUDGET
): UIMessage[] {
  if (charBudget <= 0) return messages

  const currentTurnIndex = messages.findLastIndex(
    message => message.role === 'user' && !isSourceContextMessage(message)
  )
  const historyEnd =
    currentTurnIndex === -1 ? messages.length : currentTurnIndex

  const weights: number[] = []
  for (let i = 0; i < historyEnd; i++) {
    for (const part of messages[i].parts) {
      const length = getPastedLength(part)
      if (length > 0) weights.push(length)
    }
  }

  const dropCount = getWeightDroppedCount(weights, charBudget, 1)
  if (dropCount === 0) return messages

  let seen = 0
  return messages.map((message, index) => {
    if (index >= historyEnd || seen >= dropCount) return message
    if (!message.parts.some(part => getPastedLength(part) > 0)) return message

    const parts = message.parts.map(part => {
      const length = getPastedLength(part)
      if (length === 0) return part

      seen += 1
      if (seen > dropCount) return part

      return {
        type: 'text' as const,
        text: `[Pasted content omitted from history: ${length} characters. Ask the user to paste it again if you need to look at it again.]`
      }
    })

    return { ...message, parts }
  })
}
