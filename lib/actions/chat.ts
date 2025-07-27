'use server'

import { revalidateTag } from 'next/cache'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import type { Chat, Message } from '@/lib/db/schema'
import { generateId } from '@/lib/db/schema'
import type { UIMessage } from '@/lib/types/ai'
import { getTextFromParts } from '@/lib/utils/message-utils'

/**
 * Get all chats for the current user
 */
export async function getChats() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }
  return dbActions.getChats(userId)
}

/**
 * Get a chat with messages (no cache)
 */
export async function getChat(
  chatId: string,
  requestingUserId?: string
): Promise<(Chat & { messages: UIMessage[] }) | null> {
  const chat = await dbActions.getChat(chatId, requestingUserId)
  if (!chat) {
    return null
  }

  const messages = await dbActions.loadChat(chatId)
  return { ...chat, messages }
}

/**
 * Create a new chat
 */
export async function createChat(id?: string, title?: string): Promise<Chat> {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const chatId = id || generateId()
  const chatTitle = title || 'New Chat'

  // Create chat
  const chat = await dbActions.createChat({
    id: chatId,
    title: chatTitle.substring(0, 255),
    userId,
    visibility: 'private'
  })

  // Revalidate cache
  revalidateTag(`chat-${chatId}`)
  revalidateTag('chat')

  return chat
}

/**
 * Create a new chat and save the first message
 */
export async function createChatAndSaveMessage(
  message: UIMessage,
  title?: string
): Promise<{ chat: Chat; message: Message }> {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const chatId = generateId()
  const messageId = message.id || generateId()

  // Extract title from message if not provided
  const chatTitle =
    title || getTextFromParts(message.parts as any[]) || 'New Chat'

  // Create chat
  const chat = await dbActions.createChat({
    id: chatId,
    title: chatTitle.substring(0, 255),
    userId,
    visibility: 'private'
  })

  // Save message
  const dbMessage = await dbActions.upsertMessage({
    ...message,
    id: messageId,
    chatId
  })

  // Revalidate cache
  revalidateTag(`chat-${chatId}`)

  return { chat, message: dbMessage }
}

/**
 * Save a message to an existing chat
 */
export async function saveMessage(
  chatId: string,
  message: UIMessage
): Promise<Message> {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  // Verify access
  const chat = await dbActions.getChat(chatId, userId)
  if (!chat) {
    throw new Error('Chat not found or unauthorized')
  }

  const messageId = message.id || generateId()
  const dbMessage = await dbActions.upsertMessage({
    ...message,
    id: messageId,
    chatId
  })

  // Revalidate cache
  revalidateTag(`chat-${chatId}`)

  return dbMessage
}

/**
 * Delete a chat
 */
export async function deleteChat(chatId: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { error: 'User not authenticated' }
  }

  const result = await dbActions.deleteChat(chatId, userId)

  if (result.success) {
    revalidateTag(`chat-${chatId}`)
    revalidateTag('chat')
  }

  return result
}

/**
 * Clear all chats for the current user
 */
export async function clearChats() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { error: 'User not authenticated' }
  }

  const chats = await dbActions.getChats(userId)

  for (const chat of chats) {
    await dbActions.deleteChat(chat.id, userId)
  }

  revalidateTag('chat')
  return { success: true }
}

/**
 * Delete messages after a specific message
 */
export async function deleteMessagesAfter(chatId: string, messageId: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { error: 'User not authenticated' }
  }

  // Verify access
  const chat = await dbActions.getChat(chatId, userId)
  if (!chat || chat.userId !== userId) {
    return { error: 'Unauthorized' }
  }

  const result = await dbActions.deleteMessagesAfter(chatId, messageId)

  revalidateTag(`chat-${chatId}`)

  return { success: true, count: result.count }
}

/**
 * Share a chat (make it public)
 */
export async function shareChat(chatId: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  const updatedChat = await dbActions.updateChatVisibility(
    chatId,
    userId,
    'public'
  )

  if (updatedChat) {
    revalidateTag(`chat-${chatId}`)
  }

  return updatedChat
}

/**
 * Delete messages from a specific message index
 */
export async function deleteMessagesFromIndex(
  chatId: string,
  messageId: string
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { error: 'User not authenticated' }
  }

  // Verify access
  const chat = await dbActions.getChat(chatId, userId)
  if (!chat || chat.userId !== userId) {
    return { error: 'Unauthorized' }
  }

  const result = await dbActions.deleteMessagesFromIndex(chatId, messageId)

  revalidateTag(`chat-${chatId}`)

  return { success: true, count: result.count }
}
