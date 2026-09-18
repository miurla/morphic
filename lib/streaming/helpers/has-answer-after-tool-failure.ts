type ResponsePart = {
  type?: string
  state?: string
  text?: string
}

type ResponseWithParts = {
  parts?: ResponsePart[]
}

/**
 * Whether the turn answered after its last failed tool call.
 *
 * A tool failure the agent recovered from is followed by the answer it wrote
 * with whatever the other calls returned. A tool failure that ended the turn
 * leaves only what the model had said before reaching for the tool, which is a
 * preamble and not an answer. Both messages carry text, so position is what
 * separates them.
 *
 * A failure that never reached the message cannot be placed, so the turn is not
 * credited with an answer it cannot be shown to have produced.
 */
export function hasAnswerAfterToolFailure(
  response: ResponseWithParts | null | undefined
): boolean {
  const parts = response?.parts ?? []

  let lastFailure = -1
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index]?.state === 'output-error') lastFailure = index
  }
  if (lastFailure === -1) return false

  return parts
    .slice(lastFailure + 1)
    .some(part => part.type === 'text' && (part.text ?? '').trim().length > 0)
}
