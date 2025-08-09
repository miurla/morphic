import { UIMessage } from 'ai'

/**
 * Filter out reasoning parts from messages before sending to the model API.
 *
 * OpenAI API requires that reasoning messages are followed by assistant messages,
 * and empty reasoning parts can cause API errors. This helper removes all reasoning
 * parts from the message history to prevent these issues.
 *
 * @param messages - Array of UI messages from the chat history
 * @returns Filtered messages without reasoning parts
 */
export function filterReasoningParts(messages: UIMessage[]): UIMessage[] {
  return messages.map(msg => {
    if (msg.parts && Array.isArray(msg.parts)) {
      const filteredParts = msg.parts.filter((part: any) => {
        // Remove all reasoning parts (including empty ones)
        // These are displayed in the UI but should not be sent to the API
        return part.type !== 'reasoning'
      })

      return {
        ...msg,
        parts: filteredParts
      }
    }
    return msg
  })
}
