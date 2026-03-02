import { UIMessage } from 'ai'

/**
 * Strips reasoning parts from UIMessages for OpenAI models.
 *
 * OpenAI's Responses API requires reasoning items and their following items
 * (tool-calls or text) to be kept together. The AI SDK's convertToModelMessages
 * doesn't properly handle these requirements, causing errors like:
 * "Item 'rs_...' of type 'reasoning' was provided without its required following item"
 *
 * By stripping reasoning parts before conversion, we avoid this compatibility issue.
 *
 * @see https://github.com/vercel/ai/issues/11036
 */
export function stripReasoningParts(messages: UIMessage[]): UIMessage[] {
  return messages.map(msg => {
    if (msg.role !== 'assistant' || !msg.parts) {
      return msg
    }

    const filteredParts = msg.parts.filter(part => part.type !== 'reasoning')

    // If all parts were reasoning, keep the original message
    if (filteredParts.length === 0) {
      return msg
    }

    return { ...msg, parts: filteredParts }
  })
}
