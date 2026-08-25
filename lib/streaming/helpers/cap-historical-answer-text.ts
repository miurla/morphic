import type { UIMessage } from 'ai'

import { sliceWithoutSplittingSurrogatePair } from './slice-without-splitting-surrogate-pair'

const DEFAULT_ANSWER_TEXT_LIMIT = 12_000
const DEFAULT_ANSWER_TEXT_EXEMPT_TURNS = 2
const INCOMPLETE_CITATION_PATTERN =
  /(?:\[\s*\d+(?:\s*\]?(?:\s*\(\s*(?:#[^)]*)?)?)?|\[[^\]\r\n]+\]\(\s*[^)\r\n]*)$/
const OMITTED_ANSWER_PLACEHOLDER =
  '[Earlier answer text omitted from replay. The full answer remains visible in the conversation.]'

type AnswerTextPart = { type: 'text'; text: string }

export function hasReplayableAnswerText(message: UIMessage): boolean {
  return (
    message.role === 'assistant' &&
    message.parts.some(part => part.type === 'text' && part.text.trim())
  )
}

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

export function selectHistoricalAssistantMessagesToCap(
  messages: UIMessage[],
  exemptCount: number
): Set<UIMessage> {
  const currentTurnIndex = messages.findLastIndex(
    message => message.role === 'user'
  )
  const historyEnd =
    currentTurnIndex === -1 ? messages.length : currentTurnIndex
  const assistantCount = messages
    .slice(0, historyEnd)
    .filter(hasReplayableAnswerText).length
  const cappedAssistantCount = Math.max(
    0,
    assistantCount - Math.max(0, Math.floor(exemptCount))
  )

  let seenAssistants = 0
  const selected = new Set<UIMessage>()
  for (const [index, message] of messages.entries()) {
    if (index >= historyEnd) break
    if (!hasReplayableAnswerText(message)) continue

    seenAssistants += 1
    if (seenAssistants > cappedAssistantCount) break
    selected.add(message)
  }

  return selected
}

export function capAnswerTextParts(
  textParts: AnswerTextPart[],
  maxChars: number
): AnswerTextPart[] {
  if (
    maxChars <= 0 ||
    textParts.reduce((total, part) => total + part.text.length, 0) <= maxChars
  ) {
    return textParts
  }

  let remaining = maxChars
  const cappedParts: AnswerTextPart[] = []
  for (const part of textParts) {
    if (remaining <= 0) continue

    if (part.text.length <= remaining) {
      remaining -= part.text.length
      cappedParts.push(part)
      continue
    }

    const text = truncateAnswerText(part.text, remaining)
    remaining = 0
    if (text) cappedParts.push({ ...part, text })
  }

  cappedParts.push({ type: 'text', text: OMITTED_ANSWER_PLACEHOLDER })
  return cappedParts
}
