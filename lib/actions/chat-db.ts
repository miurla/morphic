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

  // Attempt to fetch chat data.
  // Try getSharedChat first; it might be a public chat or one shared via a link (if system supports).
  // We assume getSharedChat fetches by ID and doesn't require a userId for public/shared entities.
  const potentialSharedChat = await chatDb.getSharedChat(chatId)
  if (potentialSharedChat) {
    // Assuming potentialSharedChat is compatible with DBChat or is DBChat itself.
    // If it's a different type, appropriate mapping/casting would be needed here.
    chat = potentialSharedChat as DBChat
  }

  // If not found through getSharedChat (e.g., it's private) AND a user is logged in,
  // try to fetch it as a chat belonging to that user.
  if (!chat && requestingUserId) {
    chat = await chatDb.getChat(chatId, requestingUserId)
  }

  // If chat is still not found after these attempts, it either doesn't exist or isn't accessible
  // through the primary fetch mechanisms used.
  if (!chat) {
    return null
  }

  // Authorization check
  const isOwner = requestingUserId && chat.userId === requestingUserId
  const isPublic = chat.visibility === 'public'

  if (isPublic) {
    // Public chat: access granted.
  } else if (chat.visibility === 'private') {
    if (!isOwner) {
      return null // Private chat, but the requesting user is not the owner.
    }
    // Private chat and user is owner: access granted.
  } else {
    // Chat is neither 'public' nor 'private' (e.g., unknown visibility status),
    // or some other condition not met. Deny access.
    return null
  }

  // If access is granted, fetch messages for the chat.
  const messages = await chatDb.getChatMessages(chatId)

  return { ...chat, messages }
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
