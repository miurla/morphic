import type { ModelMessage } from 'ai'

export const RELATED_QUESTIONS_REMINDER = `Response format reminder: When this turn produces a substantive answer, end it with exactly one related-questions \`\`\`spec JSONL block containing exactly three questions, using the schema in the system instructions. Omit the block only for the skip cases listed there.`

/**
 * Keeps the related-questions requirement next to the current request instead
 * of leaving it only at the start of an increasingly long conversation. It goes
 * in a message of its own: folding it into an existing message would rewrite
 * history that the next turn replays without it, so the prompt prefix would
 * differ every turn and stop being cacheable.
 */
export function appendRelatedQuestionsReminder(
  messages: ModelMessage[]
): ModelMessage[] {
  if (!messages.some(message => message.role === 'user')) return messages

  return [
    ...messages,
    {
      role: 'user',
      content: [{ type: 'text', text: RELATED_QUESTIONS_REMINDER }]
    }
  ]
}
