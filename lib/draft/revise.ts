export type ReviseIntent = 'alternatives' | 'edit'

const ALTERNATIVES_INSTRUCTION =
  'Show alternatives in chat only. Do not call editDraft or write a draft block. Wait for the user to select and explicitly request application before changing the draft.'

export function reviseQuery(query: string, intent: ReviseIntent): string {
  const instruction =
    intent === 'alternatives'
      ? ALTERNATIVES_INSTRUCTION
      : 'Edit only the requested range of the current draft. Leave all other text unchanged.'
  return `${instruction}\nPreserve the latest editing scope, protected passages, word count, structure, FAQ, and all other existing constraints unless explicitly changed by this request.\n\n${query}`
}

/** Also used when rebuilding history so even an unexpected model write cannot apply a candidate. */
export function isReviseAlternativesTurn(message: {
  role: string
  parts?: Array<{ type: string; [key: string]: unknown }>
}): boolean {
  return (
    message.role === 'user' &&
    message.parts?.some(
      part =>
        part.type === 'text' &&
        typeof part.text === 'string' &&
        part.text.startsWith(ALTERNATIVES_INSTRUCTION)
    ) === true
  )
}
