'use server'

import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm'

import type { UIMessage } from '@/lib/types/ai'
import type { PersistableUIMessage } from '@/lib/types/message-persistence'
import {
  buildUIMessageFromDB,
  mapUIMessagePartsToDBParts,
  mapUIMessageToDBMessage
} from '@/lib/utils/message-mapping'
import { perfLog, perfTime } from '@/lib/utils/perf-logging'
import { incrementDbOperationCount } from '@/lib/utils/perf-tracking'

import type { Chat, Message, Project } from './schema'
import { chats, generateId, messages, parts, projects } from './schema'
import { withOptionalRLS, withRLS } from './with-rls'
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
  return withRLS(userId, async tx => {
    const [chat] = await tx
      .insert(chats)
      .values({
        id,
        title,
        userId,
        visibility
      })
      .returning()

    return chat
  })
}

/**
 * Get chat by ID with permission check
 */
export async function getChat(
  chatId: string,
  userId?: string
): Promise<Chat | null> {
  // For public chats or when no userId, use regular db connection
  // For private chats with userId, use RLS
  return withOptionalRLS(userId || null, async tx => {
    const [chat] = await tx
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1)

    if (!chat) {
      return null
    }

    // Additional permission check for backward compatibility
    if (chat.visibility === 'public') {
      return chat
    }

    if (chat.visibility === 'private' && userId && chat.userId === userId) {
      return chat
    }

    return null
  })
}

/**
 * Upsert a message with its parts
 * Note: This function should be called with appropriate userId context
 */
export async function upsertMessage(
  message: PersistableUIMessage & { chatId: string },
  userId?: string
): Promise<Message> {
  const count = incrementDbOperationCount()
  perfLog(`DB - upsertMessage called - count: ${count}`)

  // Use RLS if userId is provided, otherwise use regular db
  const executeFn = userId
    ? (callback: (tx: any) => Promise<Message>) => withRLS(userId, callback)
    : (callback: (tx: any) => Promise<Message>) => db.transaction(callback)

  const result = await executeFn(async tx => {
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

  return result
}

/**
 * Load chat messages with parts
 * Note: Caller should verify chat access permissions before calling this
 */
export async function loadChat(
  chatId: string,
  userId?: string
): Promise<UIMessage[]> {
  return withOptionalRLS(userId || null, async tx => {
    // Use Drizzle's query API with relations
    const result = await tx.query.messages.findMany({
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
  })
}

/**
 * Load chat with messages in a single query (optimized)
 */
export async function loadChatWithMessages(
  chatId: string,
  userId?: string
): Promise<(Chat & { messages: UIMessage[] }) | null> {
  const count = incrementDbOperationCount()
  perfLog(`DB - loadChatWithMessages called - count: ${count}`)

  return withOptionalRLS(userId || null, async tx => {
    // Get chat and messages in parallel
    const [chatResult, messagesResult] = await Promise.all([
      tx.select().from(chats).where(eq(chats.id, chatId)).limit(1),
      tx.query.messages.findMany({
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

    // Permission check for backward compatibility
    if (chat.visibility === 'private' && (!userId || chat.userId !== userId)) {
      return null
    }

    // Build result
    const uiMessages = messagesResult.map(msg =>
      buildUIMessageFromDB(msg, msg.parts)
    )
    return { ...chat, messages: uiMessages }
  })
}

/**
 * Delete messages after a specific message
 */
export async function deleteMessagesAfter(
  chatId: string,
  messageId: string,
  userId?: string
): Promise<{ count: number }> {
  return withOptionalRLS(userId || null, async tx => {
    // Get the message's timestamp
    const [targetMessage] = await tx
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1)

    if (!targetMessage) {
      return { count: 0 }
    }

    // Find messages to delete
    const messagesToDelete = await tx
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
      await tx.delete(messages).where(inArray(messages.id, messageIds))
    }

    return { count: messageIds.length }
  })
}

/**
 * Delete messages from a specific index
 */
export async function deleteMessagesFromIndex(
  chatId: string,
  messageId: string,
  userId?: string
): Promise<{ count: number }> {
  return withOptionalRLS(userId || null, async tx => {
    // Get all messages for the chat
    const allMessages = await tx
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
      await tx.delete(messages).where(inArray(messages.id, messageIds))
    }

    return { count: messageIds.length }
  })
}

/**
 * Get all chats for a user
 */
export async function getChats(userId: string): Promise<Chat[]> {
  return withRLS(userId, async tx => {
    return tx
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.createdAt))
  })
}

/**
 * Get chats with pagination
 */
export async function getChatsPage(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ chats: Chat[]; nextOffset: number | null }> {
  try {
    return withRLS(userId, async tx => {
      const results = await tx
        .select()
        .from(chats)
        .where(eq(chats.userId, userId))
        .orderBy(desc(chats.createdAt))
        .limit(limit)
        .offset(offset)

      const nextOffset = results.length === limit ? offset + limit : null

      return {
        chats: results,
        nextOffset
      }
    })
  } catch (error) {
    console.error('Error fetching chat page:', error)
    return { chats: [], nextOffset: null }
  }
}

/**
 * Delete a chat
 */
export async function deleteChat(
  chatId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return withRLS(userId, async tx => {
      // Verify ownership
      const [chat] = await tx
        .select()
        .from(chats)
        .where(eq(chats.id, chatId))
        .limit(1)

      if (!chat || chat.userId !== userId) {
        return { success: false, error: 'Unauthorized' }
      }

      // Delete the chat (messages and parts will cascade)
      await tx.delete(chats).where(eq(chats.id, chatId))

      return { success: true }
    })
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
  return withRLS(userId, async tx => {
    const chat = await getChat(chatId, userId)
    if (!chat || chat.userId !== userId) {
      return null
    }

    const [updatedChat] = await tx
      .update(chats)
      .set({ visibility })
      .where(eq(chats.id, chatId))
      .returning()

    return updatedChat
  })
}

/**
 * Update chat title
 */
export async function updateChatTitle(
  chatId: string,
  title: string,
  userId?: string
): Promise<Chat | null> {
  return withOptionalRLS(userId || null, async tx => {
    const [updatedChat] = await tx
      .update(chats)
      .set({ title })
      .where(eq(chats.id, chatId))
      .returning()

    return updatedChat || null
  })
}

/**
 * Create a chat with the first message in a single transaction
 * Optimized for new chat creation
 */
export async function createChatWithFirstMessageTransaction({
  chatId,
  chatTitle,
  userId,
  message
}: {
  chatId: string
  chatTitle: string
  userId: string
  message: PersistableUIMessage
}): Promise<{ chat: Chat; message: Message }> {
  perfLog(`DB - createChatWithFirstMessageTransaction start`)
  const dbStart = performance.now()
  return await withRLS(userId, async tx => {
    // 1. Create chat
    const [chat] = await tx
      .insert(chats)
      .values({
        id: chatId,
        title: chatTitle.substring(0, 255),
        userId,
        visibility: 'private',
        createdAt: new Date()
      })
      .returning()

    // 2. Save message
    const dbMessage = mapUIMessageToDBMessage({ ...message, chatId })
    const [savedMessage] = await tx
      .insert(messages)
      .values(dbMessage)
      .returning()

    // 3. Save parts if they exist
    if (message.parts && message.parts.length > 0) {
      const partsData = mapUIMessagePartsToDBParts(
        message.parts,
        savedMessage.id
      )
      if (partsData.length > 0) {
        await tx.insert(parts).values(partsData)
      }
    }

    perfTime('DB - createChatWithFirstMessageTransaction completed', dbStart)
    return { chat, message: savedMessage }
  })
}

// ─── Projects ───────────────────────────────────────────────────────────────

/**
 * Create a new project
 */
export async function createProject({
  id = generateId(),
  name,
  userId,
  description,
  instructions
}: {
  id?: string
  name: string
  userId: string
  description?: string
  instructions?: string
}): Promise<Project> {
  return withRLS(userId, async tx => {
    const [project] = await tx
      .insert(projects)
      .values({ id, name, userId, description, instructions })
      .returning()
    return project
  })
}

/**
 * Get all projects for a user (newest first)
 */
export async function getProjects(userId: string): Promise<Project[]> {
  return withRLS(userId, async tx => {
    return tx
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.createdAt))
  })
}

/**
 * Get a single project (with ownership check)
 */
export async function getProject(
  projectId: string,
  userId: string
): Promise<Project | undefined> {
  return withRLS(userId, async tx => {
    const [project] = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    return project
  })
}

/**
 * Get a project together with its chats
 */
export async function getProjectWithChats(
  projectId: string,
  userId: string
): Promise<{ project: Project; chats: Chat[] } | undefined> {
  return withRLS(userId, async tx => {
    const [project] = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    if (!project) return undefined
    const projectChats = await tx
      .select()
      .from(chats)
      .where(and(eq(chats.projectId, projectId), eq(chats.userId, userId)))
      .orderBy(desc(chats.createdAt))
    return { project, chats: projectChats }
  })
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  userId: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'instructions'>>
): Promise<Project | undefined> {
  return withRLS(userId, async tx => {
    const [updated] = await tx
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning()
    return updated
  })
}

/**
 * Delete a project (chats are kept, their projectId is set to null via FK cascade)
 */
export async function deleteProject(
  projectId: string,
  userId: string
): Promise<{ success: boolean }> {
  return withRLS(userId, async tx => {
    const result = await tx
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning({ id: projects.id })
    return { success: result.length > 0 }
  })
}

/**
 * Assign or remove a chat from a project
 */
export async function updateChatProject(
  chatId: string,
  userId: string,
  projectId: string | null
): Promise<Chat | undefined> {
  return withRLS(userId, async tx => {
    const [updated] = await tx
      .update(chats)
      .set({ projectId })
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .returning()
    return updated
  })
}
