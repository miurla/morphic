import type { ModelMessage } from 'ai'

export function buildSpaceInstructions(
  space: { about: string; style: string } | null | undefined
): string {
  if (!space) return ''
  const body = [space.about.trim(), space.style.trim()]
    .filter(Boolean)
    .join('\n')
  if (!body) return ''

  return `## Space instructions
The user groups their work into spaces; these instructions apply to every
chat in this space. They override the defaults above for output language,
tone, structure, length, and formatting. They do not change the search,
fetch, and citation rules above.
<space_instructions>
${body}
</space_instructions>`
}

export const SPACE_NOTE =
  '(Follow the Space instructions in the system prompt: output language, tone, structure, length, and formatting. Search and citation rules still apply.)'

/**
 * The model weighs the user's own message over the system prompt for things
 * like output language, so each user turn carries a fixed pointer to the space
 * instructions. Every user message gets the same text, which keeps the prompt
 * prefix stable from turn to turn.
 */
export function attachSpaceNote(
  messages: ModelMessage[],
  spaceInstructions: string
): ModelMessage[] {
  if (!spaceInstructions) return messages

  return messages.map(message => {
    if (message.role !== 'user') return message
    const note = { type: 'text' as const, text: SPACE_NOTE }
    return {
      ...message,
      content:
        typeof message.content === 'string'
          ? [{ type: 'text' as const, text: message.content }, note]
          : [...message.content, note]
    }
  })
}
