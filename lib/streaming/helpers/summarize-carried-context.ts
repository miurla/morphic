import type { UIMessage } from 'ai'

import { estimateAttachmentTokens } from '@/lib/utils/attachment-tokens'

import { isFilePart } from './attachment-parts'

/**
 * The weight a turn carries in structured parts, split by kind.
 *
 * An attachment and a pasted block are the same thing to a bill: both are
 * replayed on every later turn and both can be the largest thing in a request.
 * The trace could not tell them apart, because `describeTurnInput` summarizes
 * structured parts only when the turn has no typed text, and nothing described
 * the history at all.
 *
 * Kind and size only, never content, for the same reason `describeTurnInput`
 * gives: the content itself already reaches the child generations.
 *
 * Run this on the messages that are about to be converted, after the history
 * guards. An attachment they turned into a placeholder is a text part by then
 * and is correctly not counted, so this reports the weight the guards left
 * rather than what the conversation holds.
 *
 * It cannot be taken any later than that: `truncateMessages` runs on converted
 * messages, where a pasted block is already indistinguishable from any other
 * text, so the kinds this reports no longer exist there. A turn that reached
 * that last resort therefore carries less than this says, and is flagged with
 * `contextWindowTruncated` so the two cases are never confused.
 */
export function summarizeCarriedContext(
  messages: UIMessage[]
): Record<string, number> | undefined {
  let attachments = 0
  let attachmentTokens = 0
  let pastedChars = 0
  let quotedChars = 0
  let noteChars = 0

  for (const message of messages) {
    for (const part of message.parts) {
      if (isFilePart(part)) {
        attachments += 1
        attachmentTokens += estimateAttachmentTokens(part)
        continue
      }

      const text = (part as { data?: { text?: unknown } }).data?.text
      if (typeof text !== 'string') continue

      if (part.type === 'data-pastedContent') pastedChars += text.length
      if (part.type === 'data-quotedContext') quotedChars += text.length
      if (part.type === 'data-noteContext') noteChars += text.length
    }
  }

  const summary = {
    ...(attachments > 0 && { attachments }),
    ...(attachmentTokens > 0 && { attachmentTokens }),
    ...(pastedChars > 0 && { pastedChars }),
    ...(quotedChars > 0 && { quotedChars }),
    ...(noteChars > 0 && { noteChars })
  }

  return Object.keys(summary).length > 0 ? summary : undefined
}
