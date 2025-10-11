import type { UIMessage } from 'ai'

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
