import { and, desc, eq, gt } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '.'
import { chats, messages, type Chat, type Message } from './schema'

// Create a new chat
export async function createChat({
  title,
  userId,
  visibility = 'private'
}: {
  title: string
  userId: string
  visibility?: 'public' | 'private'
}): Promise<Chat> {
  const [chat] = await db
    .insert(chats)
    .values({
      title,
      userId,
      visibility
    })
    .returning()

  return chat
}

// Get a chat by ID
export async function getChat(
  id: string,
  userId: string
): Promise<Chat | null> {
  const [chat] = await db.select().from(chats).where(eq(chats.id, id)).limit(1)

  // If userId is provided, check if the chat belongs to the user or is public
  if (chat && chat.userId !== userId && chat.visibility !== 'public') {
    return null // User doesn't have access to this chat
  }

  return chat || null
}

// Get all chats for a user
export async function getChats(userId: string): Promise<Chat[]> {
  return db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(chats.createdAt)
}

// Get chats with pagination
export async function getChatsPage(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ chats: Chat[]; nextOffset: number | null }> {
  try {
    const results = await db
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
  } catch (error) {
    console.error('Error fetching chat page:', error)
    return { chats: [], nextOffset: null }
  }
}

// Update a chat
export async function updateChat(
  id: string,
  data: Partial<Pick<Chat, 'title' | 'visibility'>>
): Promise<Chat | null> {
  const [chat] = await db
    .update(chats)
    .set({
      ...data,
      updatedAt: new Date().toISOString()
    })
    .where(eq(chats.id, id))
    .returning()

  return chat || null
}

// Delete a chat and its messages
export async function deleteChat(
  id: string,
  userId: string
): Promise<{ error?: string }> {
  try {
    // First verify the chat exists and belongs to the user
    const chat = await getChat(id, userId)

    if (!chat) {
      console.warn(`Attempted to delete non-existent chat: ${id}`)
      return { error: 'Chat not found' }
    }

    // Check if the chat belongs to the user
    if (chat.userId !== userId) {
      return { error: 'Unauthorized' }
    }

    // Delete the chat
    await db.delete(chats).where(eq(chats.id, id))

    // Revalidate the root path where the chat history is displayed
    revalidatePath('/')

    return {}
  } catch (error) {
    console.error(`Error deleting chat ${id}:`, error)
    return { error: 'Failed to delete chat' }
  }
}

// Add a message to a chat
export async function addMessage({
  id, // Optional ID parameter
  chatId,
  role,
  parts
}: {
  id?: string // Make ID optional
  chatId: string
  role: string
  parts: any
}): Promise<Message> {
  const valuesToInsert: {
    id?: string
    chatId: string
    role: string
    parts: any
  } = {
    chatId,
    role,
    parts
  }

  if (id) {
    valuesToInsert.id = id // Set ID if provided
  }

  const [message] = await db
    .insert(messages)
    .values(valuesToInsert) // Use the modified values
    .returning()

  return message
}

// Get all messages for a chat
export async function getChatMessages(chatId: string): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt)
}

// Delete all messages created after (strictly greater than) the
// given timestamp in the same chat.
export async function deleteMessagesByChatIdAfterTimestamp(
  chatId: string,
  timestamp: string // Assuming this is an ISO 8601 string
): Promise<{ count: number; error?: string }> {
  try {
    const result = await db
      .delete(messages)
      .where(
        and(
          eq(messages.chatId, chatId),
          gt(messages.createdAt, timestamp) // Use the ISO string directly
        )
      )
      .returning({ id: messages.id }) // Returning something to count
    return { count: result.length }
  } catch (error) {
    console.error(
      `Error deleting messages for chat ${chatId} after ${timestamp}:`,
      error
    )
    return { count: 0, error: 'Failed to delete messages' }
  }
}

// Clear all chats for a user
export async function clearChats(userId: string): Promise<{ error?: string }> {
  try {
    // Get all chat IDs for this user
    const userChats = await getChats(userId)

    if (!userChats.length) {
      return { error: 'No chats to clear' }
    }

    // Delete all chats for this user
    // Message deletion happens automatically due to ON DELETE CASCADE
    await db.delete(chats).where(eq(chats.userId, userId))

    revalidatePath('/')
    redirect('/')
  } catch (error) {
    console.error('Error clearing chats:', error)
    return { error: 'Failed to clear chats' }
  }
}

// Save a chat (create or update)
export async function saveChat(chat: Chat, userId: string) {
  try {
    // Check if the chat exists
    const existingChat = await getChat(chat.id, userId)

    if (existingChat) {
      // Update existing chat
      return await db
        .update(chats)
        .set({
          title: chat.title,
          visibility: chat.visibility,
          updatedAt: new Date().toISOString()
        })
        .where(eq(chats.id, chat.id))
        .returning()
    } else {
      // Create new chat
      return await db
        .insert(chats)
        .values({
          id: chat.id,
          title: chat.title,
          userId,
          visibility: chat.visibility || 'private'
        })
        .returning()
    }
  } catch (error) {
    console.error('Error saving chat:', error)
    throw error
  }
}

// Get a shared chat
export async function getSharedChat(id: string) {
  try {
    // For shared chats, we bypass the userId check and directly query the database
    const [chat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, id))
      .limit(1)

    if (!chat || chat.visibility !== 'public') {
      return null
    }

    return chat
  } catch (error) {
    console.error('Error getting shared chat:', error)
    return null
  }
}

// Share a chat (make it public)
export async function shareChat(id: string, userId: string) {
  try {
    const chat = await getChat(id, userId)

    if (!chat || chat.userId !== userId) {
      return null
    }

    // Update the chat to be public
    const [updatedChat] = await db
      .update(chats)
      .set({
        visibility: 'public',
        updatedAt: new Date().toISOString()
      })
      .where(eq(chats.id, id))
      .returning()

    if (updatedChat) {
      return {
        ...updatedChat,
        sharePath: `/share/${id}`
      }
    }

    return null
  } catch (error) {
    console.error('Error sharing chat:', error)
    return null
  }
}

// Update the content (parts) of a specific message
export async function updateMessageContent(
  messageId: string,
  newParts: any // Assuming parts can be of any structure, similar to addMessage
): Promise<Message | null> {
  try {
    const [updatedMessage] = await db
      .update(messages)
      .set({
        parts: newParts,
        updatedAt: new Date().toISOString() // Convert Date to ISO string
      })
      .where(eq(messages.id, messageId))
      .returning()

    return updatedMessage || null
  } catch (error) {
    console.error(
      `Error updating message content for message ${messageId}:`,
      error
    )
    return null
  }
}
