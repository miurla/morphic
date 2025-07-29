import { ModelMessage, UIMessage } from 'ai'

import { type Message as DBMessage } from '@/lib/db/schema'

// Interface matching the expected DB message input format
interface DatabaseMessageInput {
  role: DBMessage['role']
  parts: any // Using 'any' here as we don't know the exact structure expected by the database
}

/**
 * Converts a single message from AI SDK to a database-compatible message format
 * @param message - Message from AI SDK
 * @returns Database-compatible message object
 */
export function convertMessageForDB(
  message: ModelMessage
): DatabaseMessageInput {
  // Handle case where content might be a string, array, or null
  let parts: any

  if (message.content === null || message.content === undefined) {
    parts = []
  } else if (typeof message.content === 'string') {
    parts = [{ text: message.content }]
  } else if (Array.isArray(message.content)) {
    // For array content (common in assistant messages with tool calls)
    // Extract text parts and join them
    const textParts = message.content
      .filter(part => part.type === 'text')
      .map(part => ({ text: part.text }))

    if (textParts.length > 0) {
      parts = textParts
    } else {
      // If no text parts, use the first part's content or stringify the whole content
      parts = [{ text: JSON.stringify(message.content) }]
    }
  } else {
    // Fall back to JSON string for other content types
    parts = [{ text: JSON.stringify(message.content) }]
  }

  return {
    role: message.role,
    parts: parts
  }
}

/**
 * Converts an array of messages from AI SDK to database-compatible message format
 * @param messages - Array of messages from AI SDK
 * @returns Array of database-compatible message objects
 */
export function convertMessagesForDB(
  messages: ModelMessage[]
): DatabaseMessageInput[] {
  return messages.map(convertMessageForDB)
}

/**
 * Extract the first text content from a message for use as a title
 * @param message - Message from AI SDK
 * @param maxLength - Maximum title length to extract
 * @returns Extracted title string, truncated to maxLength
 */
export function extractTitleFromMessage(
  message: ModelMessage,
  maxLength = 100
): string {
  if (!message.content) return 'New Chat'

  if (typeof message.content === 'string') {
    return message.content.substring(0, maxLength)
  }

  // For array content, try to find text parts
  if (Array.isArray(message.content)) {
    const textPart = message.content.find(part => part.type === 'text')
    if (textPart && 'text' in textPart) {
      return textPart.text.substring(0, maxLength)
    }
  }

  return 'New Chat'
}

/**
 * Extracts text content from UIMessage parts.
 * @param parts Array of message parts to extract text from.
 * @returns Concatenated text content or empty string if no text content is found,
 *          if 'message' or 'message.parts' is undefined, or if 'parts' is empty or contains no text parts.
 */
export function getTextFromParts(parts?: UIMessage['parts']): string {
  return (
    parts
      ?.filter(part => part.type === 'text')
      .map(part => part.text)
      .join(' ') ?? ''
  )
}

/**
 * Merges two UIMessage objects by combining their parts
 * @param primaryMessage The main message (properties from this will be preserved)
 * @param secondaryMessage The message whose parts will be merged into the primary message
 * @returns A new UIMessage with combined parts
 */
export function mergeUIMessages(
  primaryMessage: UIMessage,
  secondaryMessage: UIMessage
): UIMessage {
  return {
    ...primaryMessage,
    parts: [...primaryMessage.parts, ...secondaryMessage.parts]
  }
}

/**
 * Checks if a UIMessage contains tool calls
 * @param message The message to check for tool calls
 * @returns true if the message contains tool calls, false otherwise
 */
export function hasToolCalls(message: UIMessage | null): boolean {
  if (!message || !message.parts) return false

  return message.parts.some(
    (part: any) =>
      part.type && (part.type.startsWith('tool-') || part.type === 'tool-call')
  )
}
