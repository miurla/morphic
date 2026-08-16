import type { ModelMessage } from 'ai'

export const RELATED_QUESTIONS_REMINDER = `Response format reminder: When this turn produces a substantive answer, end it with exactly one related-questions \`\`\`spec JSONL block containing exactly three questions, using the schema in the system instructions. Omit the block only for the skip cases listed there.`

// Providers whose API rejects a prompt that does not strictly alternate roles,
// and so cannot be given the reminder as a message of its own.
const PROVIDERS_REQUIRING_ALTERNATING_ROLES = new Set(['google'])

/**
 * Keeps the related-questions requirement next to the current request instead
 * of leaving it only at the start of an increasingly long conversation.
 *
 * The reminder goes in a message of its own, because folding it into the
 * current user message rewrites history that the next turn replays without it:
 * the prompt prefix would then differ on every turn and stop being cacheable.
 * Providers that require alternating roles cannot take the extra message, so
 * they fall back to folding and keep the prefix cost.
 */
export function appendRelatedQuestionsReminder(
  messages: ModelMessage[],
  providerId?: string
): ModelMessage[] {
  const lastUserIndex = messages.findLastIndex(
    message => message.role === 'user'
  )

  if (lastUserIndex === -1) return messages

  const reminderPart = {
    type: 'text' as const,
    text: RELATED_QUESTIONS_REMINDER
  }

  if (
    providerId === undefined ||
    !PROVIDERS_REQUIRING_ALTERNATING_ROLES.has(providerId)
  ) {
    return [...messages, { role: 'user', content: [reminderPart] }]
  }

  const userMessage = messages[lastUserIndex]
  if (userMessage.role !== 'user') return messages

  const content =
    typeof userMessage.content === 'string'
      ? [{ type: 'text' as const, text: userMessage.content }, reminderPart]
      : [...userMessage.content, reminderPart]

  const updatedMessages = [...messages]
  updatedMessages[lastUserIndex] = { ...userMessage, content }

  return updatedMessages
}
