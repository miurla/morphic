'use server'

import { getCurrentUserId } from '@/lib/auth/get-current-user' // Import getCurrentUserId
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

// Get a single chat by ID, including its messages, with permission checks.
export async function getChat(
  chatId: string,
  requestingUserId?: string // Optional: for logged-in user context
): Promise<(DBChat & { messages: DBMessage[] }) | null> {
  let chat: DBChat | null = null

  // Step 1: Attempt to fetch the chat using a method that could find public/shared chats.
  // We assume chatDb.getSharedChat(chatId) is the best candidate for this.
  chat = await chatDb.getSharedChat(chatId)

  // Step 2: If not found by the general method, AND a user is logged in,
  // try to fetch it as a private chat belonging to that user.
  if (!chat && requestingUserId) {
    const privateChat = await chatDb.getChat(chatId, requestingUserId)
    // Ensure the fetched private chat actually belongs to the requesting user,
    // in case chatDb.getChat isn't strictly scoped or for an extra layer of caution.
    if (privateChat && privateChat.userId === requestingUserId) {
      chat = privateChat
    } else if (privateChat) {
      // This case should ideally not happen if chatDb.getChat is correctly scoped.
      // Logging it can help identify issues if it does occur.
      console.warn(
        `getChat: chatDb.getChat for user ${requestingUserId} returned chat ${chatId} owned by ${privateChat.userId}. Denying access.`
      )
      // Do not assign to 'chat', effectively treating it as not found for this user.
    }
  }

  // Step 3: If no chat record was found by any means, return null.
  if (!chat) {
    return null
  }

  // Step 4: Permission checks on the retrieved chat record.
  if (chat.visibility === 'public') {
    // Public chat: access granted to anyone (authenticated or not).
    const messages = await chatDb.getChatMessages(chatId)
    return { ...chat, messages }
  }

  if (chat.visibility === 'private') {
    // Private chat: access granted only if the requestingUser is the owner.
    if (requestingUserId && chat.userId === requestingUserId) {
      const messages = await chatDb.getChatMessages(chatId)
      return { ...chat, messages }
    } else {
      // User is not the owner, or user is not authenticated.
      return null
    }
  }

  // If chat visibility is neither 'public' nor 'private', or any other unhandled case.
  console.warn(
    `getChat: Chat ${chatId} has unhandled visibility '${chat.visibility}'. Denying access.`
  )
  return null
}

// Clear all chats for a user
export async function clearChats(): Promise<{
  error?: string
  success?: boolean
}> {
  const userId = await getCurrentUserId() // Get userId on the server
  if (!userId) {
    return { error: 'User not authenticated' }
  }
  try {
    const result = await chatDb.clearChats(userId) // Call the db function
    if (result.error) {
      return { error: result.error }
    }
    return { success: true } // Indicate success
  } catch (error) {
    // This catch might be redundant if chatDb.clearChats handles its own errors and returns { error: ... }
    // However, it can catch unexpected errors during the call to chatDb.clearChats itself.
    console.error('Error in server action clearChats:', error)
    return { error: 'Failed to clear chats at server action level' }
  }
}

// Delete a single chat
export async function deleteChat(chatId: string): Promise<{
  error?: string
  success?: boolean
}> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { error: 'User not authenticated' }
  }
  try {
    const result = await chatDb.deleteChat(chatId, userId)
    // Assuming chatDb.deleteChat also returns a similar object or throws an error
    // If chatDb.deleteChat returns something else, this part needs adjustment
    if (result && 'error' in result && result.error) {
      return { error: result.error }
    }
    // If chatDb.deleteChat signifies success differently, adjust this condition
    // For example, if it returns the deleted chat or a count > 0 on success
    // For now, let's assume if no error, it's a success. Consider a more explicit success check.
    return { success: true }
  } catch (error: any) {
    console.error(
      `Error in server action deleteChat for chat ID ${chatId}:`,
      error
    )
    return {
      error: error.message || 'Failed to delete chat at server action level'
    }
  }
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

// Interface for single message save
interface SaveMessageInput {
  id?: string
  chatId: string
  role: string
  parts: any
}

// Save a single message
export async function saveSingleMessage(
  message: SaveMessageInput
): Promise<DBMessage> {
  try {
    return await chatDb.addMessage(message)
  } catch (error) {
    console.error(`Error saving message for chat ID ${message.chatId}:`, error)
    throw error
  }
}

// Save or create a chat and add a user message
export async function saveChatMessage(
  chatId: string,
  messageId: string,
  messageContent: any,
  messageRole: string,
  userId: string,
  title?: string
): Promise<{ chat: DBChat; message: DBMessage }> {
  try {
    // 1. Check if chat exists
    const existingChat = await chatDb.getChat(chatId, userId)

    // 2. Save or update chat if needed
    let chat: DBChat
    if (!existingChat) {
      // Create new chat
      const chatTitle =
        title ||
        (typeof messageContent === 'string' ? messageContent : 'New Chat')
      const chatDataForDb: Partial<DBChat> = {
        id: chatId,
        title: chatTitle.substring(0, 255), // Limit title length
        userId: userId,
        visibility: 'private'
      }

      const savedChats = await chatDb.saveChat(chatDataForDb as DBChat, userId)
      chat = savedChats[0]
    } else {
      chat = existingChat
    }

    // 3. Save message
    const message = await chatDb.addMessage({
      id: messageId,
      chatId,
      role: messageRole,
      parts: messageContent
    })

    return { chat, message }
  } catch (error) {
    console.error(`Error in saveChatMessage for chat ID ${chatId}:`, error)
    throw error
  }
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

// Share a chat (makes it public if authorized)
export async function shareChat(id: string): Promise<DBChat | null> {
  const userId = await getCurrentUserId() // Get user ID on the server

  if (!userId) {
    // Or throw new Error('Authentication required to share a chat.');
    // Depending on how you want to handle unauthorized attempts at the action level.
    console.error('shareChat: User not authenticated')
    return null
  }

  // We assume chatDb.shareChat updates the chat in the DB (e.g., sets visibility to public)
  // and handles ownership check (i.e., if this userId can share this chat id).
  // It should return the updated chat object (DBChat), or null on failure/permission denied.
  const updatedChat = await chatDb.shareChat(id, userId)

  if (!updatedChat) {
    // The operation to share the chat in the database failed or was not permitted
    return null
  }

  // Return the updated chat object. The concept of a specific sharePath is obsolete.
  return updatedChat
}
