import type { ModelMessage } from 'ai'

export const RELATED_QUESTIONS_REMINDER = `Response format reminder: When this turn produces a substantive answer, end it with exactly one related-questions \`\`\`spec JSONL block containing exactly three questions, using the schema in the system instructions. Omit the block only for the skip cases listed there.`

/**
 * Keeps the related-questions requirement next to the current request instead
 * of leaving it only at the start of an increasingly long conversation.
 */
export function appendRelatedQuestionsReminder(
  messages: ModelMessage[]
): ModelMessage[] {
  const lastUserIndex = messages.findLastIndex(
    message => message.role === 'user'
  )

  if (lastUserIndex === -1) return messages

  const userMessage = messages[lastUserIndex]
  if (userMessage.role !== 'user') return messages

  const reminderPart = {
    type: 'text' as const,
    text: RELATED_QUESTIONS_REMINDER
  }
  const content =
    typeof userMessage.content === 'string'
      ? [{ type: 'text' as const, text: userMessage.content }, reminderPart]
      : [...userMessage.content, reminderPart]

  const updatedMessages = [...messages]
  updatedMessages[lastUserIndex] = { ...userMessage, content }

  return updatedMessages
}
