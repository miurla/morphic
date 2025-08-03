'use server'

import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm'

import { chatCache } from '@/lib/cache/memory-cache'
import type { UIMessage } from '@/lib/types/ai'
import type { PersistableUIMessage } from '@/lib/types/message-persistence'
import {
  buildUIMessageFromDB,
  mapUIMessagePartsToDBParts,
  mapUIMessageToDBMessage
} from '@/lib/utils/message-mapping'

import type { Chat, Message } from './schema'
import { chats, generateId, messages, parts } from './schema'
import { db } from '.'

/**
 * Create a new chat
 */
export async function createChat({
  id = generateId(),
  title,
  userId,
  visibility = 'private'
}: {
  id?: string
  title: string
  userId: string
  visibility?: 'public' | 'private'
}): Promise<Chat> {
  const [chat] = await db
    .insert(chats)
    .values({
      id,
      title,
      userId,
      visibility
    })
    .returning()

  // Invalidate cache for this chat
  chatCache.deletePattern(`${id}-`)

  return chat
}

/**
 * Get chat by ID with permission check
 */
export async function getChat(
  chatId: string,
  userId?: string
): Promise<Chat | null> {
  const [chat] = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  if (!chat) {
    return null
  }

  // Permission check
  if (chat.visibility === 'public') {
    return chat
  }

  if (chat.visibility === 'private' && userId && chat.userId === userId) {
    return chat
  }

  return null
}

/**
 * Upsert a message with its parts
 */
export async function upsertMessage(
  message: PersistableUIMessage & { chatId: string }
): Promise<Message> {
  const result = await db.transaction(async tx => {
    // 1. Insert or update the message
    const messageData = mapUIMessageToDBMessage(message)
    const [dbMessage] = await tx
      .insert(messages)
      .values(messageData)
      .onConflictDoUpdate({
        target: messages.id,
        set: { role: messageData.role }
      })
      .returning()

    // 2. Delete existing parts
    await tx.delete(parts).where(eq(parts.messageId, message.id))

    // 3. Insert new parts
    if (message.parts && message.parts.length > 0) {
      const dbParts = mapUIMessagePartsToDBParts(message.parts, message.id)
      if (dbParts.length > 0) {
        await tx.insert(parts).values(dbParts)
      }
    }

    return dbMessage
  })

  // Invalidate cache after successful transaction
  // Using setTimeout to ensure this happens after transaction commit
  setTimeout(() => {
    chatCache.deletePattern(`${message.chatId}-`)
  }, 0)

  return result
}

/**
 * Load chat messages with parts
 */
export async function loadChat(chatId: string): Promise<UIMessage[]> {
  // Use Drizzle's query API with relations
  const result = await db.query.messages.findMany({
    where: eq(messages.chatId, chatId),
    with: {
      parts: {
        orderBy: [asc(parts.order)]
      }
    },
    orderBy: [asc(messages.createdAt)]
  })

  // Convert to UI format
  return result.map(msg => buildUIMessageFromDB(msg, msg.parts))
}

/**
 * Load chat with messages in a single query (optimized)
 */
export async function loadChatWithMessages(
  chatId: string,
  userId?: string
): Promise<(Chat & { messages: UIMessage[] }) | null> {
  // Don't check cache yet - need to verify permissions first

  // Get chat and messages in parallel
  const [chatResult, messagesResult] = await Promise.all([
    db.select().from(chats).where(eq(chats.id, chatId)).limit(1),
    db.query.messages.findMany({
      where: eq(messages.chatId, chatId),
      with: {
        parts: {
          orderBy: [asc(parts.order)]
        }
      },
      orderBy: [asc(messages.createdAt)]
    })
  ])

  const chat = chatResult[0]
  if (!chat) {
    return null
  }

  // Permission check
  if (chat.visibility === 'private' && (!userId || chat.userId !== userId)) {
    return null
  }

  // Now check cache with visibility included in key
  const cacheKey = `${chatId}-${userId || 'anonymous'}-${chat.visibility}`
  const cached = chatCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Build result and cache it
  const uiMessages = messagesResult.map(msg =>
    buildUIMessageFromDB(msg, msg.parts)
  )

  const result = { ...chat, messages: uiMessages }
  chatCache.set(cacheKey, result)
  return result
}

/**
 * Delete messages after a specific message
 */
export async function deleteMessagesAfter(
  chatId: string,
  messageId: string
): Promise<{ count: number }> {
  // Get the message's timestamp
  const [targetMessage] = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1)

  if (!targetMessage) {
    return { count: 0 }
  }

  // Find messages to delete
  const messagesToDelete = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.chatId, chatId),
        gt(messages.createdAt, targetMessage.createdAt)
      )
    )

  const messageIds = messagesToDelete.map(m => m.id)

  if (messageIds.length > 0) {
    // Delete messages (parts will be cascade deleted)
    await db.delete(messages).where(inArray(messages.id, messageIds))

    // Invalidate cache for this chat
    chatCache.deletePattern(`${chatId}-`)
  }

  return { count: messageIds.length }
}

/**
 * Delete messages from a specific index
 */
export async function deleteMessagesFromIndex(
  chatId: string,
  messageId: string
): Promise<{ count: number }> {
  // Get all messages for the chat
  const allMessages = await db
    .select({ id: messages.id, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))

  // Find the index of the target message
  const messageIndex = allMessages.findIndex(m => m.id === messageId)

  if (messageIndex === -1) {
    return { count: 0 }
  }

  // Get messages to delete (from index onwards)
  const messagesToDelete = allMessages.slice(messageIndex)
  const messageIds = messagesToDelete.map(m => m.id)

  if (messageIds.length > 0) {
    await db.delete(messages).where(inArray(messages.id, messageIds))

    // Invalidate cache for this chat
    chatCache.deletePattern(`${chatId}-`)
  }

  return { count: messageIds.length }
}

/**
 * Get all chats for a user
 */
export async function getChats(userId: string): Promise<Chat[]> {
  return db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.createdAt))
}

/**
 * Delete a chat
 */
export async function deleteChat(
  chatId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify ownership
    const chat = await getChat(chatId, userId)
    if (!chat || chat.userId !== userId) {
      return { success: false, error: 'Unauthorized' }
    }

    // Delete the chat (messages and parts will cascade)
    await db.delete(chats).where(eq(chats.id, chatId))

    // Invalidate cache for this chat
    chatCache.deletePattern(`${chatId}-`)

    return { success: true }
  } catch (error) {
    console.error('Error deleting chat:', error)
    return { success: false, error: 'Failed to delete chat' }
  }
}

/**
 * Update chat visibility
 */
export async function updateChatVisibility(
  chatId: string,
  userId: string,
  visibility: 'public' | 'private'
): Promise<Chat | null> {
  const chat = await getChat(chatId, userId)
  if (!chat || chat.userId !== userId) {
    return null
  }

  const [updatedChat] = await db
    .update(chats)
    .set({ visibility })
    .where(eq(chats.id, chatId))
    .returning()

  // Invalidate cache for this chat
  if (updatedChat) {
    chatCache.deletePattern(`${chatId}-`)
  }

  return updatedChat
}

/**
 * Update chat title
 */
export async function updateChatTitle(
  chatId: string,
  title: string
): Promise<Chat | null> {
  const [updatedChat] = await db
    .update(chats)
    .set({ title })
    .where(eq(chats.id, chatId))
    .returning()

  // Invalidate cache for this chat
  if (updatedChat) {
    chatCache.deletePattern(`${chatId}-`)
  }

  return updatedChat || null
}
