import type { UIMessage } from 'ai'

import type { QueryLang, QueryLenBucket, QueryShape } from './types'

const URL_PATTERN = /https?:\/\//i
const JAPANESE_PATTERN = /[぀-ヿ㐀-鿿]/
const LATIN_PATTERN = /[a-z]/i

function lenBucket(length: number): QueryLenBucket {
  if (length <= 20) return '0-20'
  if (length <= 50) return '21-50'
  if (length <= 120) return '51-120'
  return '120+'
}

function detectLang(text: string): QueryLang {
  if (LATIN_PATTERN.test(text) && !JAPANESE_PATTERN.test(text)) return 'en'
  return 'other'
}

/**
 * Derive a privacy-preserving shape from a raw user query.
 * The raw text is never returned or sent onward.
 */
export function deriveQueryShape(text: string): QueryShape {
  const trimmed = text.trim()
  return {
    queryLenBucket: lenBucket(trimmed.length),
    hasUrl: URL_PATTERN.test(trimmed),
    lang: detectLang(trimmed)
  }
}

/**
 * Calculate the conversation turn number from message history
 *
 * The turn number represents how many user messages have been sent,
 * which indicates the follow-up count (1 = initial message, 2+ = follow-ups)
 *
 * @param messages - Array of UI messages from the conversation
 * @returns Turn number (1-indexed)
 *
 * @example
 * ```typescript
 * const messages = [
 *   { role: 'user', parts: [...] },
 *   { role: 'assistant', parts: [...] },
 *   { role: 'user', parts: [...] }
 * ]
 * calculateConversationTurn(messages) // Returns 2
 * ```
 */
export function calculateConversationTurn(messages: UIMessage[]): number {
  const userMessageCount = messages.filter(msg => msg.role === 'user').length
  return Math.max(1, userMessageCount)
}
