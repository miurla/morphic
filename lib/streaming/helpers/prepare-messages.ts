import { UIMessage } from 'ai'

import {
  createChat,
  deleteMessagesFromIndex,
  loadChat,
  upsertMessage
} from '@/lib/actions/chat'
import { generateId } from '@/lib/db/schema'

import type { StreamContext } from './types'

const DEFAULT_CHAT_TITLE = 'Untitled'

export async function prepareMessages(
  context: StreamContext,
  message: UIMessage | null
): Promise<UIMessage[]> {
  const { chatId, userId, trigger, messageId, initialChat } = context

  if (trigger === 'regenerate-assistant-message' && messageId) {
    // Handle regeneration - use initialChat if available to avoid DB call
    let currentChat = initialChat
    if (!currentChat) {
      currentChat = await loadChat(chatId, userId)
    }
    if (!currentChat || !currentChat.messages.length) {
      throw new Error('No messages found')
    }

    let messageIndex = currentChat.messages.findIndex(
      (m: any) => m.id === messageId
    )

    // Fallback: If message not found by ID, try to find by position
    if (messageIndex === -1) {
      const lastAssistantIndex = currentChat.messages.findLastIndex(
        (m: any) => m.role === 'assistant'
      )
      const lastUserIndex = currentChat.messages.findLastIndex(
        (m: any) => m.role === 'user'
      )

      if (lastAssistantIndex >= 0 || lastUserIndex >= 0) {
        messageIndex = Math.max(lastAssistantIndex, lastUserIndex)
      } else {
        throw new Error(
          `Message ${messageId} not found and no fallback available`
        )
      }
    }

    const targetMessage = currentChat.messages[messageIndex]
    if (targetMessage.role === 'assistant') {
      await deleteMessagesFromIndex(chatId, messageId)
      return currentChat.messages.slice(0, messageIndex)
    } else {
      // User message edit
      if (message && message.id === messageId) {
        await upsertMessage(chatId, message)
      }
      const messagesToDelete = currentChat.messages.slice(messageIndex + 1)
      if (messagesToDelete.length > 0) {
        await deleteMessagesFromIndex(chatId, messagesToDelete[0].id)
      }
      const updatedChat = await loadChat(chatId, userId)
      return (
        updatedChat?.messages || currentChat.messages.slice(0, messageIndex + 1)
      )
    }
  } else {
    // Handle normal message submission
    if (!message) {
      throw new Error('No message provided')
    }

    const messageWithId = {
      ...message,
      id: message.id || generateId()
    }

    if (!initialChat) {
      await createChat(chatId, DEFAULT_CHAT_TITLE)
    }

    await upsertMessage(chatId, messageWithId)

    // If we have initialChat, append the new message instead of fetching all messages
    if (initialChat && initialChat.messages) {
      return [...initialChat.messages, messageWithId]
    }

    // Fallback to fetching if no initialChat
    const updatedChat = await loadChat(chatId, userId)
    return updatedChat?.messages || [messageWithId]
  }
}
