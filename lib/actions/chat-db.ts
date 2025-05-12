'use server'

import * as chatDb from '@/lib/db/chat'

// Get all chats for a user
export async function getChats(userId: string) {
  return chatDb.getChats(userId)
}

// Get chats with pagination
export async function getChatsPage(userId: string, limit = 20, offset = 0) {
  return chatDb.getChatsPage(userId, limit, offset)
}

// Get a single chat by ID
export async function getChat(id: string, userId: string) {
  return chatDb.getChat(id, userId)
}

// Clear all chats for a user
export async function clearChats(userId: string) {
  return chatDb.clearChats(userId)
}

// Delete a single chat
export async function deleteChat(chatId: string, userId: string) {
  return chatDb.deleteChat(chatId, userId)
}

// Save a chat (with message history)
export async function saveChat(chat: any, userId: string) {
  try {
    // First save the chat
    const savedChat = await chatDb.saveChat(chat, userId)

    // Then save all messages if provided
    if (chat.messages && Array.isArray(chat.messages)) {
      // Delete existing messages first to avoid duplicates
      const existingMessages = await chatDb.getChatMessages(chat.id)
      if (existingMessages.length > 0) {
        // We would need a deleteMessages function, but for now we can recreate all
        // This would be more efficiently handled with a batch delete/insert
      }

      // Add all messages
      for (const message of chat.messages) {
        await chatDb.addMessage({
          chatId: chat.id,
          role: message.role,
          parts: message.parts || message.content
        })
      }
    }

    return savedChat
  } catch (error) {
    console.error('Error in saveChat action:', error)
    throw error
  }
}

// Get a shared chat
export async function getSharedChat(id: string) {
  const chat = await chatDb.getSharedChat(id)

  if (!chat) {
    return null
  }

  // Get messages for the chat
  const messages = await chatDb.getChatMessages(id)

  // Return chat with messages
  return {
    ...chat,
    messages,
    sharePath: `/share/${id}`
  }
}

// Share a chat
export async function shareChat(id: string, userId: string) {
  return chatDb.shareChat(id, userId)
}
