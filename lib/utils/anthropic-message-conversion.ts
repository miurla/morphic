import type { ModelMessage } from 'ai'

/**
 * Fix message structure after convertToModelMessages for proper tool-call/tool-result separation.
 *
 * convertToModelMessages creates a single assistant message containing all parts (text, tool-call, text),
 * but the expected structure requires tool-call to be immediately followed by tool-result in separate messages.
 * This function splits assistant messages that contain text after tool-call parts.
 */
export function convertMessagesForAnthropic(
  messages: ModelMessage[]
): ModelMessage[] {
  const result: ModelMessage[] = []

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]

    if (message.role === 'assistant' && Array.isArray(message.content)) {
      // Check if this assistant message contains both tool-call and text after it
      let toolCallIndex = -1
      let hasContentAfterToolCall = false

      for (let j = 0; j < message.content.length; j++) {
        const part = message.content[j]
        if (part.type === 'tool-call') {
          toolCallIndex = j
        } else if (
          toolCallIndex !== -1 &&
          part.type === 'text' &&
          part.text?.trim()
        ) {
          hasContentAfterToolCall = true
          break
        }
      }

      if (hasContentAfterToolCall && toolCallIndex !== -1) {
        // Split the message: content before and including tool-call stays
        const beforeToolCall = message.content.slice(0, toolCallIndex + 1)
        const afterToolCall = message.content.slice(toolCallIndex + 1)

        // Add the first part (up to and including tool-call)
        result.push({
          ...message,
          content: beforeToolCall
        })

        // Add the tool-result message (should be the next message)
        if (i + 1 < messages.length && messages[i + 1].role === 'tool') {
          result.push(messages[i + 1])
          i++ // Skip the tool message since we've already added it
        }

        // Add the remaining content as a new assistant message
        if (afterToolCall.length > 0) {
          result.push({
            role: 'assistant',
            content: afterToolCall
          })
        }
      } else {
        // No splitting needed
        result.push(message)
      }
    } else {
      // Not an assistant message, add as-is
      result.push(message)
    }
  }

  return result
}
