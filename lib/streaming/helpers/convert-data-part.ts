import type { FilePart, TextPart } from '@ai-sdk/provider-utils'
import { randomUUID } from 'crypto'

import { isValidDataPartNonce } from './data-part-nonce'

/**
 * Maps Morphic's user-authored data parts into model input for
 * `convertToModelMessages({ convertDataPart })`. Returning `undefined` drops
 * the part from the model message.
 *
 * Pasted content is wrapped in a nonce-delimited block so the content itself
 * can never spoof the boundary — this replaces the old in-band `<user-content>`
 * marker and removes its prompt-injection / boundary-collision risk.
 *
 * The nonce is assigned upstream by `assignDataPartNonces` and read back here,
 * because it has to stay identical across turns: this converter runs over the
 * entire history on every request, and a per-request nonce rewrites all past
 * attachments and voids the prompt cache. The random fallback below only
 * applies to callers that skipped that step.
 */
function resolveNonce(data: { nonce?: unknown } | undefined): string {
  return isValidDataPartNonce(data?.nonce)
    ? data.nonce
    : randomUUID().slice(0, 8)
}

export function convertDataPart(part: {
  type: string
  data?: unknown
}): TextPart | FilePart | undefined {
  if (part.type === 'data-pastedContent') {
    const data = part.data as { text?: unknown; nonce?: unknown } | undefined
    const text = typeof data?.text === 'string' ? data.text : ''
    if (!text) return undefined
    const nonce = resolveNonce(data)
    return {
      type: 'text',
      text: `[user-pasted-content ${nonce}]\n${text}\n[/user-pasted-content ${nonce}]`
    }
  }

  if (part.type === 'data-quotedContext') {
    const data = part.data as { text?: unknown; nonce?: unknown } | undefined
    const text = typeof data?.text === 'string' ? data.text : ''
    if (!text) return undefined
    const nonce = resolveNonce(data)
    return {
      type: 'text',
      text: `[quoted-context ${nonce}]\n${text}\n[/quoted-context ${nonce}]`
    }
  }

  if (part.type === 'data-noteContext') {
    const data = part.data as
      | { title?: unknown; text?: unknown; nonce?: unknown }
      | undefined
    const text = typeof data?.text === 'string' ? data.text : ''
    const title = typeof data?.title === 'string' ? data.title.trim() : ''
    if (!text) return undefined
    const nonce = resolveNonce(data)
    const body = title ? `Title: ${title}\n\n${text}` : text
    return {
      type: 'text',
      text: `[note-context ${nonce}]\n${body}\n[/note-context ${nonce}]`
    }
  }

  if (part.type === 'data-sourceUrl') {
    const data = part.data as { url?: unknown } | undefined
    const url = typeof data?.url === 'string' ? data.url : ''
    return url ? { type: 'text', text: url } : undefined
  }

  return undefined
}
