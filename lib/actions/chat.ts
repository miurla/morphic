'use server'

import { generateChatTitle } from '@/lib/agents/title-generator'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getAuthProvider, isShareEnabled } from '@/lib/auth/provider'
import * as dbActions from '@/lib/db/actions'
import type { Chat, Message } from '@/lib/db/schema'
import { generateId } from '@/lib/db/schema'
import {
  getUserFileObjectKeyPrefix,
  signFilePartUrlsInMessages
} from '@/lib/storage/r2-client'
import type { UIMessage } from '@/lib/types/ai'
import { getTextFromParts } from '@/lib/utils/message-utils'

// Constants
const DEFAULT_CHAT_TITLE = 'Untitled'

async function signChatFilePartUrls(
  chat: (Chat & { messages: UIMessage[] }) | null
): Promise<(Chat & { messages: UIMessage[] }) | null> {
  if (!chat) return null

  return {
    ...chat,
    messages: await signFilePartUrlsInMessages(chat.messages, {
      keylessKeyPrefix: getUserFileObjectKeyPrefix(chat.userId)
    })
  }
}

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
 * Get chats with pagination for the current user
 */
export async function getChatsPage(limit = 20, offset = 0) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { chats: [], nextOffset: null }
  }
  return dbActions.getChatsPage(userId, limit, offset)
}

/**
 * Load a chat with messages
 * If requestingUserId is provided, it will be used for authorization
 * Otherwise, no authorization check is performed (assumes already authorized)
 */
export async function loadChat(
  chatId: string,
  requestingUserId?: string
): Promise<(Chat & { messages: UIMessage[] }) | null> {
  const chat = await dbActions.loadChatWithMessages(chatId, requestingUserId)

  return signChatFilePartUrls(chat)
}

/**
 * Create a new chat
 * @param userId - Required. Pass userId to avoid duplicate auth calls
 */
export async function createChat(
  id: string | undefined,
  title: string | undefined,
  userId: string
): Promise<Chat> {
  const chatId = id || generateId()
  const chatTitle = title || DEFAULT_CHAT_TITLE

  // Create chat
  const chat = await dbActions.createChat({
    id: chatId,
    title: chatTitle.substring(0, 255),
    userId,
    visibility: 'private'
  })

  return chat
}

/**
 * Create a new chat and save the first message (public API with auth)
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
    title || getTextFromParts(message.parts as any[]) || DEFAULT_CHAT_TITLE

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

  return { chat, message: dbMessage }
}

/**
 * Create a new chat with the first message in a single transaction
 * Optimized for new chat creation
 */
export async function createChatWithFirstMessage(
  chatId: string,
  message: UIMessage,
  userId: string,
  title?: string
): Promise<{ chat: Chat; message: Message }> {
  const messageId = message.id || generateId()
  const chatTitle = title || DEFAULT_CHAT_TITLE

  // Use transaction for atomic operation
  const result = await dbActions.createChatWithFirstMessageTransaction({
    chatId,
    chatTitle,
    userId,
    message: {
      ...message,
      id: messageId
    }
  })

  return result
}

/**
 * Upsert a message to a chat
 * @param userId - Required but not used for access check (assumes already authorized)
 *
 * IMPORTANT: This function assumes the caller has already performed authorization checks.
 * It is only called from:
 * 1. API routes after authentication (app/api/chat/route.ts)
 * 2. Stream handlers after chat ownership verification
 * 3. Internal functions that have already verified access
 *
 * DO NOT call this function directly from untrusted contexts.
 */
export async function upsertMessage(
  chatId: string,
  message: UIMessage,
  userId: string
): Promise<Message> {
  // Skip access check - userId is required for audit/logging but not for authorization
  // Caller MUST ensure authorization before calling this function
  const messageId = message.id || generateId()
  const dbMessage = await dbActions.upsertMessage(
    {
      ...message,
      id: messageId,
      chatId
    },
    userId
  )

  return dbMessage
}

/**
 * Delete a chat
 */
export async function deleteChat(chatId: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'User not authenticated' }
  }

  const result = await dbActions.deleteChat(chatId, userId)

  return result
}

/**
 * Clear all chats for the current user
 */
export async function clearChats() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'User not authenticated' }
  }

  const chats = await dbActions.getChats(userId)

  for (const chat of chats) {
    await dbActions.deleteChat(chat.id, userId)
  }

  return { success: true }
}

/**
 * Delete messages after a specific message
 */
export async function deleteMessagesAfter(chatId: string, messageId: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, error: 'User not authenticated' }
  }

  // Verify access
  const chat = await dbActions.getChat(chatId, userId)
  if (!chat || chat.userId !== userId) {
    return { success: false, error: 'Unauthorized' }
  }

  const result = await dbActions.deleteMessagesAfter(chatId, messageId)

  return { success: true, count: result.count }
}

/**
 * Share a chat (make it public)
 */
export async function shareChat(chatId: string) {
  // The active provider must support sharing: anonymous mode maps every
  // chat to one shared identity and has no share capability, so the
  // action must not publish chats the UI refuses to share.
  const provider = getAuthProvider()
  if (!provider.capabilities.share) {
    return null
  }
  // Better Auth additionally requires the ENABLE_SHARE opt-in; Supabase
  // sharing has never needed a flag, so the default path behaves as on
  // main. Enforced here, not just in the UI, so the action cannot be
  // called directly while sharing is disabled.
  if (provider.name === 'better-auth' && !isShareEnabled()) {
    return null
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  const updatedChat = await dbActions.updateChatVisibility(
    chatId,
    userId,
    'public'
  )

  return updatedChat
}

/**
 * Delete messages from a specific message index
 */
export async function deleteMessagesFromIndex(
  chatId: string,
  messageId: string,
  userIdOverride?: string
) {
  const userId = userIdOverride ?? (await getCurrentUserId())
  if (!userId) {
    return { success: false, error: 'User not authenticated' }
  }

  // Verify access
  const chat = await dbActions.getChat(chatId, userId)
  if (!chat || chat.userId !== userId) {
    return { success: false, error: 'Unauthorized' }
  }

  const result = await dbActions.deleteMessagesFromIndex(
    chatId,
    messageId,
    userId
  )

  return { success: true, count: result.count }
}

/**
 * Save or update chat title if it's the first conversation
 * @param chat Existing chat object (null if new chat)
 * @param chatId The chat ID
 * @param message The user message to generate title from
 * @param modelId The model ID to use for title generation
 */
export async function saveChatTitle(
  chat: Chat | null,
  chatId: string,
  message: UIMessage | null,
  modelId: string
) {
  if (!chat && message) {
    const userContent = getTextFromParts(message.parts)
    const title = await generateChatTitle({
      userMessageContent: userContent,
      modelId
    })
    await dbActions.updateChatTitle(chatId, title)
  }
}
