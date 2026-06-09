import type { FilePart, TextPart } from '@ai-sdk/provider-utils'
import { randomUUID } from 'crypto'

/**
 * Maps Morphic's user-authored data parts into model input for
 * `convertToModelMessages({ convertDataPart })`. Returning `undefined` drops
 * the part from the model message.
 *
 * Pasted content is wrapped in a nonce-delimited block so the content itself
 * can never spoof the boundary — this replaces the old in-band `<user-content>`
 * marker and removes its prompt-injection / boundary-collision risk.
 */
export function convertDataPart(part: {
  type: string
  data?: unknown
}): TextPart | FilePart | undefined {
  if (part.type === 'data-pastedContent') {
    const data = part.data as { text?: unknown } | undefined
    const text = typeof data?.text === 'string' ? data.text : ''
    if (!text) return undefined
    const nonce = randomUUID().slice(0, 8)
    return {
      type: 'text',
      text: `[user-pasted-content ${nonce}]\n${text}\n[/user-pasted-content ${nonce}]`
    }
  }

  if (part.type === 'data-sourceUrl') {
    const data = part.data as { url?: unknown } | undefined
    const url = typeof data?.url === 'string' ? data.url : ''
    return url ? { type: 'text', text: url } : undefined
  }

  return undefined
}
