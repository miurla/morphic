import { UIMessage } from 'ai'

import { stripSpecBlocks } from '@/lib/render/strip-spec-blocks'

/**
 * Strips ```spec fenced blocks from assistant message text parts
 * before converting to model messages. This prevents prior spec
 * payloads from being fed back into the model on subsequent turns,
 * wasting context window budget.
 */
export function stripSpecFromMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map(msg => {
    if (msg.role !== 'assistant' || !msg.parts) {
      return msg
    }

    const parts = msg.parts.map(part => {
      if (part.type === 'text' && typeof part.text === 'string') {
        const stripped = stripSpecBlocks(part.text)
        if (stripped !== part.text) {
          return { ...part, text: stripped }
        }
      }
      return part
    })

    return { ...msg, parts }
  })
}
