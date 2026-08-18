import { UIMessage } from 'ai'

const SPEC_FENCE = /```spec[\s\S]*?```/g

// The related-questions block is the only spec block whose JSONL carries a
// heading with this icon.
const RELATED_QUESTIONS_MARKER = '"icon":"related"'

/**
 * Removes ```spec fenced blocks from assistant message text, keeping the
 * related-questions block. Dropping the rest stops prior spec payloads from
 * spending context window budget on every later turn; keeping the related one
 * leaves the model an example of the format it is asked to keep producing.
 *
 * The result must depend only on the text passed in, because this runs on the
 * prompt-cache prefix and a message has to replay identically on every turn.
 * That is also why this does not reuse the clipboard helper, whose job is
 * readable output rather than a stable prefix.
 */
function stripNonRelatedSpecBlocks(text: string): string {
  let removed = false

  const stripped = text.replace(SPEC_FENCE, block => {
    if (block.includes(RELATED_QUESTIONS_MARKER)) {
      return block
    }
    removed = true
    return ''
  })

  if (!removed) {
    return text
  }

  // Only normalize when a block was taken out, so that text without spec
  // blocks passes through unchanged.
  return stripped.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Applies the strip to assistant message text parts before converting to
 * model messages.
 */
export function stripSpecFromMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map(msg => {
    if (msg.role !== 'assistant' || !msg.parts) {
      return msg
    }

    const parts = msg.parts.map(part => {
      if (part.type === 'text' && typeof part.text === 'string') {
        const stripped = stripNonRelatedSpecBlocks(part.text)
        if (stripped !== part.text) {
          return { ...part, text: stripped }
        }
      }
      return part
    })

    return { ...msg, parts }
  })
}
