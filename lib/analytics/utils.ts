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
 * Calculate the conversation turn number (1-indexed) for the message being sent.
 *
 * Counts distinct user messages by id. `currentMessageId` is included so the
 * result is stable whether or not the history (which may be cached) already
 * contains the message being sent.
 *
 * @param messages - User/assistant messages from the conversation
 * @param currentMessageId - Id of the message being sent, if any
 */
export function calculateConversationTurn(
  messages: UIMessage[],
  currentMessageId?: string
): number {
  const userIds = new Set(
    messages.filter(msg => msg.role === 'user').map(msg => msg.id)
  )
  if (currentMessageId) userIds.add(currentMessageId)
  return Math.max(1, userIds.size)
}
