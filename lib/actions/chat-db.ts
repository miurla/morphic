'use server'

import * as chatDb from '@/lib/db/chat'
import { type Chat as DBChat, type Message as DBMessage } from '@/lib/db/schema' // Import DB schema types

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

// Interface for chat metadata input from the client
interface ClientChatInput {
  id: string // Chat ID is required
  title: string // Title is also required
  visibility?: DBChat['visibility'] // Visibility setting is optional
}

// Interface for new message input from the client
interface ClientNewMessageInput {
  role: DBMessage['role']
  parts: DBMessage['parts']
}

export async function saveChat(
  clientChatInput: ClientChatInput,
  clientNewMessages: ClientNewMessageInput[] | undefined, // New messages are optional (e.g., when only updating metadata)
  userId: string, // Authenticated user ID is passed as a separate argument
  updateMetadata: boolean = true // New parameter to control whether to update metadata for existing chats
) {
  try {
    // 1. Check if chat exists
    const existingChat = await chatDb.getChat(clientChatInput.id, userId)

    // Variables to hold the saved/updated chat details
    let savedOrUpdatedChatDetails

    if (existingChat && !updateMetadata) {
      // If chat exists and we don't want to update metadata, use the existing chat details
      savedOrUpdatedChatDetails = existingChat
    } else {
      // Otherwise, prepare chat metadata and save/update it
      const chatDataForDb: Pick<
        DBChat,
        'id' | 'title' | 'userId' | 'visibility'
      > &
        Partial<DBChat> = {
        id: clientChatInput.id,
        title: clientChatInput.title,
        userId: userId, // Ensure authenticated user ID is used
        visibility: clientChatInput.visibility || 'private' // Set default value
      }

      // Call lib/db/chat.ts saveChat to save/update chat metadata in the DB
      const savedOrUpdatedChatArray = await chatDb.saveChat(
        chatDataForDb as DBChat,
        userId
      )
      savedOrUpdatedChatDetails =
        savedOrUpdatedChatArray && savedOrUpdatedChatArray[0]

      if (!savedOrUpdatedChatDetails) {
        throw new Error(
          `Failed to save chat metadata for chat ID: ${clientChatInput.id}. The operation returned no details.`
        )
      }
    }

    // 2. Add new messages
    if (clientNewMessages && clientNewMessages.length > 0) {
      for (const message of clientNewMessages) {
        await chatDb.addMessage({
          chatId: savedOrUpdatedChatDetails.id, // Use the ID of the saved/updated chat
          role: message.role,
          parts: message.parts
        })
      }
    }

    // Return the saved/updated chat metadata
    return savedOrUpdatedChatDetails
  } catch (error) {
    console.error(
      `Error in saveChat action for chat ID ${clientChatInput.id}:`,
      error
    )
    throw error // Rethrow the error to the caller
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
