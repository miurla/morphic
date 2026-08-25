import type { UIMessage } from 'ai'

import { sliceWithoutSplittingSurrogatePair } from './slice-without-splitting-surrogate-pair'

const DEFAULT_ANSWER_TEXT_LIMIT = 12_000
const DEFAULT_ANSWER_TEXT_EXEMPT_TURNS = 2
const INCOMPLETE_CITATION_PATTERN =
  /\[\s*\d+(?:\s*\]?(?:\s*\(\s*(?:#[^)]*)?)?)?$/
const OMITTED_ANSWER_PLACEHOLDER =
  '[Earlier answer text omitted from replay. The full answer remains visible in the conversation.]'

export function parseAnswerTextLimit(raw: string | undefined): number {
  const value = raw?.trim()
  if (!value) return DEFAULT_ANSWER_TEXT_LIMIT

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_ANSWER_TEXT_LIMIT
  }

  return parsed === 0 ? 0 : Math.max(1, Math.floor(parsed))
}

export const HISTORY_ANSWER_TEXT_LIMIT = parseAnswerTextLimit(
  process.env.HISTORY_ANSWER_TEXT_LIMIT
)

export function parseAnswerTextExemptTurns(raw: string | undefined): number {
  const value = raw?.trim()
  if (!value) return DEFAULT_ANSWER_TEXT_EXEMPT_TURNS

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_ANSWER_TEXT_EXEMPT_TURNS
  }

  return parsed === 0 ? 0 : Math.max(1, Math.floor(parsed))
}

export const HISTORY_ANSWER_TEXT_EXEMPT_TURNS = parseAnswerTextExemptTurns(
  process.env.HISTORY_ANSWER_TEXT_EXEMPT_TURNS
)

function truncateAnswerText(value: string, maxChars: number): string {
  let truncated = sliceWithoutSplittingSurrogatePair(value, maxChars)
  const whitespaceIndex = truncated.search(/\s+\S*$/)

  if (whitespaceIndex > 0) {
    truncated = truncated.slice(0, whitespaceIndex)
  }

  return truncated.replace(INCOMPLETE_CITATION_PATTERN, '').trimEnd()
}

/**
 * Caps older assistant answer text while leaving the newest replies intact.
 *
 * A message's rendered text depends only on that message and, within the newest
 * `exemptCount` assistant messages, its bounded distance from the end. Appending
 * turns can therefore move the divergence point only within that tail, keeping
 * the stable prompt prefix independent of total thread length.
 */
export function capHistoricalAnswerText(
  messages: UIMessage[],
  maxChars: number = HISTORY_ANSWER_TEXT_LIMIT,
  exemptCount: number = HISTORY_ANSWER_TEXT_EXEMPT_TURNS
): UIMessage[] {
  if (maxChars <= 0) return messages

  const currentTurnIndex = messages.findLastIndex(
    message => message.role === 'user'
  )
  const historyEnd =
    currentTurnIndex === -1 ? messages.length : currentTurnIndex
  const assistantCount = messages
    .slice(0, historyEnd)
    .filter(message => message.role === 'assistant').length
  const cappedAssistantCount = Math.max(
    0,
    assistantCount - Math.max(0, Math.floor(exemptCount))
  )

  let seenAssistants = 0
  let changed = false
  const cappedMessages = messages.map((message, index) => {
    if (index >= historyEnd || message.role !== 'assistant') return message

    seenAssistants += 1
    if (seenAssistants > cappedAssistantCount) return message

    const totalTextChars = message.parts.reduce(
      (total, part) => total + (part.type === 'text' ? part.text.length : 0),
      0
    )
    if (totalTextChars <= maxChars) return message

    let remaining = maxChars
    const parts: UIMessage['parts'] = []
    for (const part of message.parts) {
      if (part.type !== 'text') {
        parts.push(part)
        continue
      }
      if (remaining <= 0) continue

      if (part.text.length <= remaining) {
        remaining -= part.text.length
        parts.push(part)
        continue
      }

      const text = truncateAnswerText(part.text, remaining)
      remaining = 0
      if (text) parts.push({ ...part, text })
    }

    parts.push({ type: 'text', text: OMITTED_ANSWER_PLACEHOLDER })
    changed = true
    return { ...message, parts }
  })

  return changed ? cappedMessages : messages
}
