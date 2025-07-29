import type { UIMessage } from 'ai'

import {
  createChat,
  deleteMessagesFromIndex,
  getChat as getChatAction,
  saveMessage
} from '@/lib/actions/chat'
import { generateId } from '@/lib/db/schema'

// Constants
const DEFAULT_CHAT_TITLE = 'New Chat'

/**
 * Prepares messages for regeneration by handling message deletion and retrieval
 * @param chatId The chat ID
 * @param userId The user ID for authorization
 * @param messageId The message ID to regenerate from
 * @param message The new message (if any)
 * @returns Array of UIMessages to send to the model
 */
export async function prepareMessagesForRegeneration(
  chatId: string,
  userId: string,
  messageId: string,
  message: UIMessage | null
): Promise<UIMessage[]> {
  const currentChat = await getChatAction(chatId, userId)
  if (!currentChat || !currentChat.messages.length) {
    throw new Error('No messages found')
  }

  const messageIndex = currentChat.messages.findIndex(m => m.id === messageId)
  if (messageIndex === -1) {
    throw new Error(`Message ${messageId} not found`)
  }

  const targetMessage = currentChat.messages[messageIndex]

  if (targetMessage.role === 'assistant') {
    // Delete from this assistant message onwards
    await deleteMessagesFromIndex(chatId, messageId)
    // Use messages up to (but not including) this assistant message
    return currentChat.messages.slice(0, messageIndex)
  } else {
    // If it's a user message that was edited, save the updated message first
    if (message && message.id === messageId) {
      await saveMessage(chatId, message)
    }
    // Delete everything after this user message
    const messagesToDelete = currentChat.messages.slice(messageIndex + 1)
    if (messagesToDelete.length > 0) {
      await deleteMessagesFromIndex(chatId, messagesToDelete[0].id)
    }
    // Get updated messages including the edited one
    const updatedChat = await getChatAction(chatId, userId)
    if (updatedChat?.messages) {
      return updatedChat.messages
    } else {
      // Fallback: use current messages up to and including the edited message
      return currentChat.messages.slice(0, messageIndex + 1)
    }
  }
}

/**
 * Prepares messages for normal submission by saving the new message
 * @param chatId The chat ID
 * @param userId The user ID for authorization
 * @param message The message to submit
 * @param chat The existing chat (if any)
 * @returns Array of UIMessages to send to the model
 */
export async function prepareMessagesForSubmission(
  chatId: string,
  userId: string,
  message: UIMessage,
  chat: any
): Promise<UIMessage[]> {
  if (!message) {
    throw new Error('No message provided')
  }

  // Save the message
  const messageWithId = {
    ...message,
    id: message.id || generateId()
  }

  // If chat doesn't exist, create it with a temporary title
  if (!chat) {
    await createChat(chatId, DEFAULT_CHAT_TITLE)
  }

  await saveMessage(chatId, messageWithId)

  // Get all messages including the one just saved
  const updatedChat = await getChatAction(chatId, userId)
  return updatedChat?.messages || [messageWithId]
}
