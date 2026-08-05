import type { UIMessage } from 'ai'
import { createHash, randomUUID } from 'crypto'

/**
 * Data part types whose model text is wrapped in a nonce-delimited block by
 * `convertDataPart`.
 */
const NONCE_DELIMITED_DATA_TYPES = new Set([
  'data-pastedContent',
  'data-quotedContext',
  'data-noteContext'
])

const NONCE_LENGTH = 8
const NONCE_PATTERN = /^[0-9a-f]{8}$/
const MAX_DERIVED_ATTEMPTS = 16

function hashNonce(seed: string): string {
  return createHash('sha256')
    .update(`morphic:data-part-nonce:v1:${seed}`)
    .digest('hex')
    .slice(0, NONCE_LENGTH)
}

function randomNonce(): string {
  return randomUUID().slice(0, NONCE_LENGTH)
}

/**
 * Derives a delimiter nonce from the part's identity instead of its content.
 *
 * Stability is what matters for cost: `convertToModelMessages` re-runs over the
 * whole history on every turn, so a nonce that is re-rolled per request
 * rewrites every past attachment and breaks the prompt cache's
 * longest-common-prefix match.
 *
 * It still has to be unguessable to whoever wrote the attached text, which
 * rules out hashing that text: eight hex characters are brute-forceable, so
 * crafted content could carry its own closing delimiter. The seed is instead
 * built from the server-side message id and the part's position, neither of
 * which the content's author can know.
 *
 * As a last guard the nonce is re-derived while it occurs anywhere in the
 * content, so the delimiter can never appear inside the block it wraps.
 */
export function deriveDataPartNonce(seed: string, content: string): string {
  let nonce = hashNonce(seed)
  let attempt = 0

  while (content.includes(nonce)) {
    attempt++
    nonce =
      attempt < MAX_DERIVED_ATTEMPTS
        ? hashNonce(`${seed}#${attempt}`)
        : randomNonce()
  }

  return nonce
}

export function isValidDataPartNonce(value: unknown): value is string {
  return typeof value === 'string' && NONCE_PATTERN.test(value)
}

/**
 * Stamps a stable delimiter nonce onto every nonce-delimited data part so
 * `convertDataPart` can read it instead of generating a fresh one per request.
 *
 * Run this before `convertToModelMessages`. Any incoming `nonce` is discarded:
 * the delimiter is a server-side boundary, so the client never gets to pick it.
 */
export function assignDataPartNonces(messages: UIMessage[]): UIMessage[] {
  return messages.map(message => {
    if (
      !message.parts?.some(part => NONCE_DELIMITED_DATA_TYPES.has(part.type))
    ) {
      return message
    }

    const parts = message.parts.map((part, index) => {
      if (!NONCE_DELIMITED_DATA_TYPES.has(part.type)) return part

      const { nonce: _incoming, ...data } = ((
        part as { data?: Record<string, unknown> }
      ).data ?? {}) as Record<string, unknown>

      return {
        ...part,
        data: {
          ...data,
          nonce: deriveDataPartNonce(
            `${message.id}:${index}`,
            JSON.stringify(data)
          )
        }
      }
    })

    return { ...message, parts } as UIMessage
  })
}
