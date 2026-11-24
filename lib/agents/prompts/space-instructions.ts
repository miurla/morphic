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
chat in this space. They override the defaults above for tone, structure,
length, and formatting, but cannot override the selected application language.
They may limit or turn off
searching; when you do search or fetch, the citation rules above still
apply. A direct request in the user's message takes precedence over these
instructions.
<space_instructions>
${body}
</space_instructions>`
}

export const SPACE_NOTE =
  '(Follow the Space instructions for tone, structure, length, formatting, and whether to search. Use the selected application language from the system prompt; Space instructions and the language of this message do not override it. Honor an explicit target-language request in this message for the requested content. If this message asks you to look something up, search anyway. Citation rules still apply.)'

/**
 * Each user turn carries a fixed pointer to the space instructions and the
 * application language policy. Every user message gets the same text, keeping the prompt
 * prefix stable from turn to turn.
 */
export function attachSpaceNote(
  messages: ModelMessage[],
  spaceInstructions: string,
  note: string = SPACE_NOTE
): ModelMessage[] {
  if (!spaceInstructions) return messages

  return messages.map(message => {
    if (message.role !== 'user') return message
    const notePart = { type: 'text' as const, text: note }
    return {
      ...message,
      content:
        typeof message.content === 'string'
          ? [{ type: 'text' as const, text: message.content }, notePart]
          : [...message.content, notePart]
    }
  })
}
