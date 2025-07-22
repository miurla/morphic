import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateUUID } from '@/lib/utils' // Import the UUID generator

// Mock target modules first
vi.mock('@/lib/db/chat', () => ({
  clearChats: vi.fn(),
  deleteChat: vi.fn(),
  getChats: vi.fn(),
  getChatsPage: vi.fn(),
  getChat: vi.fn(),
  getSharedChat: vi.fn(),
  getChatMessages: vi.fn(),
  addMessage: vi.fn(),
  saveChat: vi.fn(),
  deleteTrailingMessages: vi.fn(),
  shareChatDb: vi.fn()
}))
vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: vi.fn()
}))

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as chatDb from '@/lib/db/chat'
import type { Chat as DBChat, Message as DBMessage } from '@/lib/db/schema' // Import DB schema types for test data

import {
  clearChats,
  deleteChat,
  getChat,
  getChats,
  saveChatMessage,
  saveSingleMessage
} from '../chat-db'

const mockClearChats = chatDb.clearChats as any
const mockDeleteChatDb = chatDb.deleteChat as any
const mockGetChatsDb = chatDb.getChats as any
const mockGetChatDb = chatDb.getChat as any
const mockGetSharedChatDb = chatDb.getSharedChat as any
const mockGetChatMessagesDb = chatDb.getChatMessages as any
const mockAddMessageDb = chatDb.addMessage as any
const mockSaveChatDb = chatDb.saveChat as any
const mockGetCurrentUserId = getCurrentUserId as any

const now = new Date().toISOString()

// Generate UUIDs for common test data to ensure uniqueness across test runs if needed,
// or use fixed UUIDs if specific ID values are part of the test logic (not the case here generally).
const commonChatId = generateUUID() // Use generateUUID
const commonUserId = generateUUID() // Use generateUUID
const commonMessageId = generateUUID() // Use generateUUID

const testChatData: DBChat = {
  id: commonChatId,
  userId: commonUserId,
  title: 'Test Chat Title',
  createdAt: now,
  visibility: 'private'
}

const testMessageData: DBMessage = {
  id: commonMessageId,
  chatId: commonChatId,
  role: 'user',
  parts: [{ type: 'text', content: 'Hello' }],
  attachments: [], // Added attachments as it is non-nullable in schema
  createdAt: now
}

describe('Chat Actions - clearChats', () => {
  let userId: string
  beforeEach(() => {
    vi.resetAllMocks()
    userId = generateUUID() // Generate a fresh UUID for each test if needed
    mockGetCurrentUserId.mockResolvedValue(userId)
  })

  it('should clear chats for an authenticated user and return success', async () => {
    mockClearChats.mockResolvedValue({})
    const result = await clearChats()
    expect(mockGetCurrentUserId).toHaveBeenCalledTimes(1)
    expect(mockClearChats).toHaveBeenCalledWith(userId)
    expect(result).toEqual({ success: true })
  })

  it('should return an error if the user is not authenticated', async () => {
    mockGetCurrentUserId.mockResolvedValue(null as unknown as string)
    const result = await clearChats()
    expect(mockClearChats).not.toHaveBeenCalled()
    expect(result).toEqual({ error: 'User not authenticated' })
  })

  it('should return an error if db operation returns error', async () => {
    mockClearChats.mockResolvedValue({ error: 'db-error' })
    const result = await clearChats()
    expect(result).toEqual({ error: 'db-error' })
  })

  it('should handle unexpected exception from db call', async () => {
    const dbError = new Error('unexpected')
    mockClearChats.mockRejectedValue(dbError)
    const result = await clearChats()
    expect(result).toEqual({
      error: 'Failed to clear chats at server action level'
    })
  })
})

// --- Tests for deleteChat ---
describe('Chat Actions - deleteChat', () => {
  let userId: string
  let chatId: string
  beforeEach(() => {
    vi.resetAllMocks()
    userId = generateUUID()
    chatId = generateUUID()
    mockGetCurrentUserId.mockResolvedValue(userId)
  })

  it('should delete a chat for an authenticated user and return success', async () => {
    mockDeleteChatDb.mockResolvedValue({ deletedCount: 1 })
    const result = await deleteChat(chatId)
    expect(mockGetCurrentUserId).toHaveBeenCalledTimes(1)
    expect(mockDeleteChatDb).toHaveBeenCalledWith(chatId, userId)
    expect(result).toEqual({ success: true })
  })

  it('should return an error if the user is not authenticated', async () => {
    mockGetCurrentUserId.mockResolvedValue(null as unknown as string)
    const result = await deleteChat(chatId)
    expect(mockDeleteChatDb).not.toHaveBeenCalled()
    expect(result).toEqual({ error: 'User not authenticated' })
  })

  it('should return an error if db operation returns an error object', async () => {
    mockDeleteChatDb.mockResolvedValue({ error: 'DB delete failed' })
    const result = await deleteChat(chatId)
    expect(mockDeleteChatDb).toHaveBeenCalledWith(chatId, userId)
    expect(result).toEqual({ error: 'DB delete failed' })
  })

  it('should handle unexpected exception from db call', async () => {
    const dbError = new Error('Unexpected DB error')
    mockDeleteChatDb.mockRejectedValue(dbError)
    const result = await deleteChat(chatId)
    expect(mockDeleteChatDb).toHaveBeenCalledWith(chatId, userId)
    expect(result).toEqual({ error: dbError.message })
  })
})

// --- Tests for getChats ---
describe('Chat Actions - getChats', () => {
  let userId: string
  beforeEach(() => {
    vi.resetAllMocks()
    userId = generateUUID()
  })

  it('should return chats for a given user ID', async () => {
    const mockChats = [
      { ...testChatData, id: generateUUID(), userId },
      { ...testChatData, id: generateUUID(), userId }
    ]
    mockGetChatsDb.mockResolvedValue(mockChats)
    const result = await getChats(userId)
    expect(mockGetChatsDb).toHaveBeenCalledWith(userId)
    expect(result).toEqual(mockChats)
  })

  it('should return an empty array if no chats are found', async () => {
    mockGetChatsDb.mockResolvedValue([])
    const result = await getChats(userId)
    expect(mockGetChatsDb).toHaveBeenCalledWith(userId)
    expect(result).toEqual([])
  })

  it('should propagate error if db operation fails', async () => {
    const dbError = new Error('DB connection error')
    mockGetChatsDb.mockRejectedValue(dbError)
    await expect(getChats(userId)).rejects.toThrow('DB connection error')
    expect(mockGetChatsDb).toHaveBeenCalledWith(userId)
  })
})

// --- Tests for getChat ---
describe('Chat Actions - getChat', () => {
  let ownerUserId: string
  let publicChat: DBChat
  let privateChat: DBChat
  let messagesForChat: DBMessage[]

  beforeEach(() => {
    vi.resetAllMocks()
    ownerUserId = generateUUID()
    const publicChatId = generateUUID()
    const privateChatId = generateUUID()

    publicChat = {
      ...testChatData,
      id: publicChatId,
      userId: ownerUserId,
      visibility: 'public'
    }
    privateChat = {
      ...testChatData,
      id: privateChatId,
      userId: ownerUserId,
      visibility: 'private'
    }
    messagesForChat = [
      { ...testMessageData, id: generateUUID(), chatId: publicChatId },
      {
        ...testMessageData,
        id: generateUUID(),
        chatId: publicChatId,
        role: 'assistant'
      }
    ]
  })

  it('should return a public chat with messages if no requestingUserId is provided', async () => {
    mockGetSharedChatDb.mockResolvedValue(publicChat)
    mockGetChatMessagesDb.mockResolvedValue(messagesForChat)
    const result = await getChat(publicChat.id)
    expect(mockGetSharedChatDb).toHaveBeenCalledWith(publicChat.id)
    expect(mockGetChatDb).not.toHaveBeenCalled()
    expect(mockGetChatMessagesDb).toHaveBeenCalledWith(publicChat.id)
    expect(result).toEqual({ ...publicChat, messages: messagesForChat })
  })

  it('should return a private chat with messages if requestingUser is the owner', async () => {
    const privateMessages = messagesForChat.map(m => ({
      ...m,
      chatId: privateChat.id
    }))
    mockGetSharedChatDb.mockResolvedValue(null)
    mockGetChatDb.mockResolvedValue(privateChat)
    mockGetChatMessagesDb.mockResolvedValue(privateMessages)
    const result = await getChat(privateChat.id, ownerUserId)
    expect(mockGetSharedChatDb).toHaveBeenCalledWith(privateChat.id)
    expect(mockGetChatDb).toHaveBeenCalledWith(privateChat.id, ownerUserId)
    expect(mockGetChatMessagesDb).toHaveBeenCalledWith(privateChat.id)
    expect(result).toEqual({ ...privateChat, messages: privateMessages })
  })

  it('should return null if private chat is requested by a non-owner', async () => {
    const nonOwnerUserId = generateUUID()
    mockGetSharedChatDb.mockResolvedValue(null)
    mockGetChatDb.mockResolvedValue(privateChat)
    const result = await getChat(privateChat.id, nonOwnerUserId)
    expect(mockGetSharedChatDb).toHaveBeenCalledWith(privateChat.id)
    expect(mockGetChatDb).toHaveBeenCalledWith(privateChat.id, nonOwnerUserId)
    expect(mockGetChatMessagesDb).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('should return null if private chat is requested without a requestingUserId', async () => {
    mockGetSharedChatDb.mockResolvedValue(null)
    const result = await getChat(privateChat.id)
    expect(mockGetSharedChatDb).toHaveBeenCalledWith(privateChat.id)
    expect(mockGetChatDb).not.toHaveBeenCalled()
    expect(mockGetChatMessagesDb).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('should return null if chat is not found by any method', async () => {
    const nonExistentChatId = generateUUID()
    mockGetSharedChatDb.mockResolvedValue(null)
    mockGetChatDb.mockResolvedValue(null)
    // Scenario 1: With a requesting user
    const resultWithUser = await getChat(nonExistentChatId, ownerUserId)
    expect(mockGetSharedChatDb).toHaveBeenCalledWith(nonExistentChatId)
    expect(mockGetChatDb).toHaveBeenCalledWith(nonExistentChatId, ownerUserId)
    expect(resultWithUser).toBeNull()
    // Scenario 2: Without a requesting user
    vi.resetAllMocks()
    mockGetSharedChatDb.mockResolvedValue(null)
    const resultWithoutUser = await getChat(nonExistentChatId)
    expect(mockGetSharedChatDb).toHaveBeenCalledWith(nonExistentChatId)
    expect(mockGetChatDb).not.toHaveBeenCalled()
    expect(mockGetChatMessagesDb).not.toHaveBeenCalled()
    expect(resultWithoutUser).toBeNull()
  })

  it('should return null and log warning if chat has unhandled visibility', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})
    const unhandledVisibilityChat: DBChat = {
      ...publicChat,
      visibility: 'friends_only' as any
    }
    mockGetSharedChatDb.mockResolvedValue(unhandledVisibilityChat)
    const result = await getChat(unhandledVisibilityChat.id)
    expect(result).toBeNull()
    expect(mockGetChatMessagesDb).not.toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      `getChat: Chat ${unhandledVisibilityChat.id} has unhandled visibility 'friends_only'. Denying access.`
    )
    consoleWarnSpy.mockRestore()
  })

  it('should return null if chatDb.getChat for a user returns a chat owned by someone else (edge case)', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})
    const requestingUserId = generateUUID()
    const actualOwnerId = generateUUID()
    const chatDataOwnedByOther: DBChat = {
      ...privateChat,
      userId: actualOwnerId
    }
    mockGetSharedChatDb.mockResolvedValue(null)
    mockGetChatDb.mockResolvedValue(chatDataOwnedByOther)
    const result = await getChat(privateChat.id, requestingUserId)
    expect(mockGetSharedChatDb).toHaveBeenCalledWith(privateChat.id)
    expect(mockGetChatDb).toHaveBeenCalledWith(privateChat.id, requestingUserId)
    expect(mockGetChatMessagesDb).not.toHaveBeenCalled()
    expect(result).toBeNull()
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      `getChat: chatDb.getChat for user ${requestingUserId} returned chat ${privateChat.id} owned by ${actualOwnerId}. Denying access.`
    )
    consoleWarnSpy.mockRestore()
  })
})

// --- Tests for saveSingleMessage ---
describe('Chat Actions - saveSingleMessage', () => {
  let chatId: string
  let messageInput: {
    id: string
    role: 'user' | 'assistant'
    parts: Array<{ type: 'text'; text: string }>
  }
  let savedMessageOutput: DBMessage

  beforeEach(() => {
    vi.resetAllMocks()
    chatId = generateUUID()
    const messageId = generateUUID()
    messageInput = {
      id: messageId,
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'Test message' }]
    }
    savedMessageOutput = {
      ...testMessageData,
      id: messageId,
      chatId: chatId,
      role: messageInput.role,
      parts: messageInput.parts
    }
  })

  it('should save a single message and return the saved message', async () => {
    mockAddMessageDb.mockResolvedValue(savedMessageOutput)
    const result = await saveSingleMessage(chatId, messageInput as any)
    expect(mockAddMessageDb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: messageInput.id,
        chatId: chatId,
        role: messageInput.role,
        parts: messageInput.parts
      })
    )
    expect(result).toEqual(savedMessageOutput)
  })

  it('should throw an error if db operation fails', async () => {
    const dbError = new Error('DB save failed')
    mockAddMessageDb.mockRejectedValue(dbError)
    await expect(
      saveSingleMessage(chatId, messageInput as any)
    ).rejects.toThrow('DB save failed')
    expect(mockAddMessageDb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: messageInput.id,
        chatId: chatId,
        role: messageInput.role,
        parts: messageInput.parts
      })
    )
  })
})

// --- Tests for saveChatMessage ---
describe('Chat Actions - saveChatMessage', () => {
  let userId: string
  let chatId: string
  let userMessageInput: { id: string; role: string; parts: any[] }
  let newChatData: DBChat
  let newMessageData: DBMessage

  beforeEach(() => {
    vi.resetAllMocks()
    userId = generateUUID()
    chatId = generateUUID()
    const messageId = generateUUID()
    userMessageInput = {
      id: messageId,
      role: 'user',
      parts: [{ type: 'text', text: 'Saving this message' }]
    }
    newChatData = {
      ...testChatData,
      id: chatId,
      userId: userId,
      title: 'Saving this message'
    }
    newMessageData = {
      ...testMessageData,
      id: userMessageInput.id,
      chatId: chatId,
      parts: userMessageInput.parts,
      role: userMessageInput.role
    }
  })

  it('should create a new chat and save message if chat does not exist', async () => {
    mockGetChatDb.mockResolvedValue(null)
    mockSaveChatDb.mockResolvedValue([newChatData])
    mockAddMessageDb.mockResolvedValue(newMessageData)
    const result = await saveChatMessage(
      chatId,
      userMessageInput as any,
      userId
    )
    expect(mockGetChatDb).toHaveBeenCalledWith(chatId, userId)
    expect(mockSaveChatDb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: chatId,
        title: newChatData.title,
        userId: userId,
        visibility: 'private'
      }),
      userId
    )
    expect(mockAddMessageDb).toHaveBeenCalledWith({
      id: userMessageInput.id,
      chatId: chatId,
      role: userMessageInput.role,
      parts: userMessageInput.parts
    })
    expect(result).toEqual({ chat: newChatData, message: newMessageData })
  })

  it('should save message to existing chat if chat exists', async () => {
    const existingChatData: DBChat = {
      ...testChatData,
      id: chatId,
      userId: userId,
      title: 'Existing Chat'
    }
    mockGetChatDb.mockResolvedValue(existingChatData)
    mockAddMessageDb.mockResolvedValue(newMessageData)
    const result = await saveChatMessage(
      chatId,
      userMessageInput as any,
      userId,
      'Custom Title'
    )
    expect(mockGetChatDb).toHaveBeenCalledWith(chatId, userId)
    expect(mockSaveChatDb).not.toHaveBeenCalled()
    expect(mockAddMessageDb).toHaveBeenCalledWith({
      id: userMessageInput.id,
      chatId: chatId,
      role: userMessageInput.role,
      parts: userMessageInput.parts
    })
    expect(result).toEqual({ chat: existingChatData, message: newMessageData })
  })

  it('should use provided title when creating a new chat', async () => {
    const customTitle = 'My Custom Chat Title'
    const chatWithCustomTitle: DBChat = { ...newChatData, title: customTitle }
    mockGetChatDb.mockResolvedValue(null)
    mockSaveChatDb.mockResolvedValue([chatWithCustomTitle])
    mockAddMessageDb.mockResolvedValue(newMessageData)
    const result = await saveChatMessage(
      chatId,
      userMessageInput as any,
      userId,
      customTitle
    )
    expect(mockSaveChatDb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: chatId,
        title: customTitle,
        userId: userId,
        visibility: 'private'
      }),
      userId
    )
    expect(result.chat.title).toBe(customTitle)
  })

  it('should throw an error if saving chat fails', async () => {
    const dbError = new Error('Failed to save chat')
    mockGetChatDb.mockResolvedValue(null)
    mockSaveChatDb.mockRejectedValue(dbError)
    await expect(
      saveChatMessage(chatId, userMessageInput as any, userId)
    ).rejects.toThrow('Failed to save chat')
  })

  it('should throw an error if saving message fails', async () => {
    const dbError = new Error('Failed to save message')
    mockGetChatDb.mockResolvedValue(newChatData)
    mockAddMessageDb.mockRejectedValue(dbError)
    await expect(
      saveChatMessage(chatId, userMessageInput as any, userId)
    ).rejects.toThrow('Failed to save message')
  })
})
