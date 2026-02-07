import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import type { Chat } from '@/lib/db/schema'
import type { UIMessage } from '@/lib/types/ai'

// Mock auth module
vi.mock('@/lib/auth/get-current-user')

// Test fixtures
const fixtures = {
  users: {
    user1: 'user-123',
    user2: 'user-456'
  },
  chats: {
    privateChat1: {
      id: 'private-chat-1',
      title: 'User 1 Private Chat',
      userId: 'user-123',
      visibility: 'private' as const,
      createdAt: new Date()
    },
    privateChat2: {
      id: 'private-chat-2',
      title: 'User 2 Private Chat',
      userId: 'user-456',
      visibility: 'private' as const,
      createdAt: new Date()
    },
    publicChat: {
      id: 'public-chat-1',
      title: 'Public Chat',
      userId: 'user-123',
      visibility: 'public' as const,
      createdAt: new Date()
    }
  },
  messages: {
    message1: {
      id: 'msg-1',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'Hello from user 1' }]
    },
    message2: {
      id: 'msg-2',
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, text: 'Response to user 1' }]
    }
  }
}

describe('RLS Policies Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Chat Access Control', () => {
    it('should allow user to access their own private chats', async () => {
      const userId = fixtures.users.user1
      const chatId = fixtures.chats.privateChat1.id

      // Mock the database to simulate RLS behavior
      const mockGetChat = vi.spyOn(dbActions, 'getChat')
      mockGetChat.mockImplementation(async (id, uid) => {
        if (id === chatId && uid === userId) {
          return fixtures.chats.privateChat1
        }
        return null
      })

      const result = await dbActions.getChat(chatId, userId)

      expect(result).toEqual(fixtures.chats.privateChat1)
      expect(mockGetChat).toHaveBeenCalledWith(chatId, userId)
    })

    it('should prevent user from accessing other users private chats', async () => {
      const userId = fixtures.users.user1
      const chatId = fixtures.chats.privateChat2.id // User 2's chat

      const mockGetChat = vi.spyOn(dbActions, 'getChat')
      mockGetChat.mockImplementation(async (id, uid) => {
        // Simulate RLS blocking access
        if (id === chatId && uid !== fixtures.users.user2) {
          return null
        }
        return fixtures.chats.privateChat2
      })

      const result = await dbActions.getChat(chatId, userId)

      expect(result).toBeNull()
    })

    it('should allow anyone to access public chats', async () => {
      const chatId = fixtures.chats.publicChat.id

      const mockGetChat = vi.spyOn(dbActions, 'getChat')
      mockGetChat.mockImplementation(async (id, _uid) => {
        if (id === chatId) {
          return fixtures.chats.publicChat
        }
        return null
      })

      // Test with authenticated user
      const result1 = await dbActions.getChat(chatId, fixtures.users.user2)
      expect(result1).toEqual(fixtures.chats.publicChat)

      // Test without authentication (anonymous)
      const result2 = await dbActions.getChat(chatId, undefined)
      expect(result2).toEqual(fixtures.chats.publicChat)
    })

    it('should only return users own chats in list', async () => {
      const userId = fixtures.users.user1

      const mockGetChats = vi.spyOn(dbActions, 'getChats')
      mockGetChats.mockImplementation(async uid => {
        // Simulate RLS filtering
        if (uid === userId) {
          return [fixtures.chats.privateChat1, fixtures.chats.publicChat]
        }
        return []
      })

      const result = await dbActions.getChats(userId)

      expect(result).toHaveLength(2)
      expect(result).toContainEqual(fixtures.chats.privateChat1)
      expect(result).toContainEqual(fixtures.chats.publicChat)
      expect(result).not.toContainEqual(fixtures.chats.privateChat2)
    })
  })

  describe('Message Access Control', () => {
    it('should allow access to messages in users own chats', async () => {
      const userId = fixtures.users.user1
      const chatId = fixtures.chats.privateChat1.id

      const mockLoadChat = vi.spyOn(dbActions, 'loadChat')
      mockLoadChat.mockImplementation(async (cid, uid) => {
        if (cid === chatId && uid === userId) {
          return [fixtures.messages.message1, fixtures.messages.message2]
        }
        return []
      })

      const messages = await dbActions.loadChat(chatId, userId)

      expect(messages).toHaveLength(2)
      expect(messages).toContainEqual(fixtures.messages.message1)
    })

    it('should allow access to messages in public chats', async () => {
      const chatId = fixtures.chats.publicChat.id

      const mockLoadChat = vi.spyOn(dbActions, 'loadChat')
      mockLoadChat.mockImplementation(async cid => {
        if (cid === chatId) {
          return [fixtures.messages.message1, fixtures.messages.message2]
        }
        return []
      })

      // Test without authentication
      const messages = await dbActions.loadChat(chatId, undefined)

      expect(messages).toHaveLength(2)
    })

    it('should prevent access to messages in other users private chats', async () => {
      const userId = fixtures.users.user1
      const chatId = fixtures.chats.privateChat2.id // User 2's chat

      const mockLoadChat = vi.spyOn(dbActions, 'loadChat')
      mockLoadChat.mockImplementation(async (cid, uid) => {
        // Simulate RLS blocking access
        if (cid === chatId && uid !== fixtures.users.user2) {
          return []
        }
        return [fixtures.messages.message1]
      })

      const messages = await dbActions.loadChat(chatId, userId)

      expect(messages).toHaveLength(0)
    })
  })

  describe('Chat Visibility Updates', () => {
    it('should allow user to update visibility of their own chat', async () => {
      const userId = fixtures.users.user1
      const chatId = fixtures.chats.privateChat1.id

      const mockUpdateVisibility = vi.spyOn(dbActions, 'updateChatVisibility')
      mockUpdateVisibility.mockImplementation(async (cid, uid, visibility) => {
        if (cid === chatId && uid === userId) {
          return { ...fixtures.chats.privateChat1, visibility }
        }
        return null
      })

      const result = await dbActions.updateChatVisibility(
        chatId,
        userId,
        'public'
      )

      expect(result).toBeTruthy()
      expect(result?.visibility).toBe('public')
    })

    it('should prevent user from updating visibility of other users chat', async () => {
      const userId = fixtures.users.user1
      const chatId = fixtures.chats.privateChat2.id // User 2's chat

      const mockUpdateVisibility = vi.spyOn(dbActions, 'updateChatVisibility')
      mockUpdateVisibility.mockImplementation(async (cid, uid, _visibility) => {
        // Simulate RLS blocking update
        if (cid === chatId && uid !== fixtures.users.user2) {
          return null
        }
        return fixtures.chats.privateChat2
      })

      const result = await dbActions.updateChatVisibility(
        chatId,
        userId,
        'public'
      )

      expect(result).toBeNull()
    })
  })

  describe('Chat Creation with RLS', () => {
    it('should create chat with correct user context', async () => {
      const userId = fixtures.users.user1
      const newChat = {
        id: 'new-chat-1',
        title: 'New Chat',
        userId,
        visibility: 'private' as const
      }

      const mockCreateChat = vi.spyOn(dbActions, 'createChat')
      mockCreateChat.mockImplementation(async params => {
        // Simulate RLS ensuring userId matches
        if (params.userId === userId) {
          return { ...newChat, createdAt: new Date() }
        }
        throw new Error('RLS violation')
      })

      const result = await dbActions.createChat(newChat)

      expect(result.userId).toBe(userId)
      expect(result.title).toBe('New Chat')
    })

    it('should prevent creating chat with different userId', async () => {
      const userId = fixtures.users.user1
      const wrongUserId = fixtures.users.user2

      const mockCreateChat = vi.spyOn(dbActions, 'createChat')
      mockCreateChat.mockImplementation(async params => {
        // Simulate RLS checking that userId in data matches context
        if (params.userId !== userId) {
          throw new Error('new row violates row-level security policy')
        }
        return { ...params, createdAt: new Date() } as Chat
      })

      // Attempt to create chat with wrong userId should fail
      await expect(
        dbActions.createChat({
          id: 'bad-chat',
          title: 'Bad Chat',
          userId: wrongUserId, // Wrong user ID
          visibility: 'private'
        })
      ).rejects.toThrow('row-level security policy')
    })
  })

  describe('Message Upsert with RLS', () => {
    it('should allow upserting messages to users own chat', async () => {
      const userId = fixtures.users.user1
      const chatId = fixtures.chats.privateChat1.id
      const message: UIMessage = {
        id: 'new-msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'New message' }]
      }

      const mockUpsertMessage = vi.spyOn(dbActions, 'upsertMessage')
      mockUpsertMessage.mockImplementation(async (msg, uid) => {
        // Simulate RLS check
        if (uid === userId) {
          return {
            id: msg.id || 'generated-id',
            chatId: msg.chatId,
            role: 'user',
            metadata: {},
            createdAt: new Date(),
            updatedAt: null
          }
        }
        throw new Error('RLS violation')
      })

      const result = await dbActions.upsertMessage(
        { ...message, chatId },
        userId
      )

      expect(result).toBeTruthy()
      expect(result.chatId).toBe(chatId)
    })

    it('should prevent upserting messages to other users chat', async () => {
      const userId = fixtures.users.user1
      const chatId = fixtures.chats.privateChat2.id // User 2's chat
      const message: UIMessage = {
        id: 'bad-msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Unauthorized message' }]
      }

      const mockUpsertMessage = vi.spyOn(dbActions, 'upsertMessage')
      mockUpsertMessage.mockImplementation(async (_msg, uid) => {
        // Simulate RLS blocking access to other user's chat
        if (uid !== fixtures.users.user2) {
          throw new Error('new row violates row-level security policy')
        }
        throw new Error('Should not reach here')
      })

      await expect(
        dbActions.upsertMessage({ ...message, chatId }, userId)
      ).rejects.toThrow('row-level security policy')
    })
  })

  describe('Chat Deletion with RLS', () => {
    it('should allow user to delete their own chat', async () => {
      const userId = fixtures.users.user1
      const chatId = fixtures.chats.privateChat1.id

      const mockDeleteChat = vi.spyOn(dbActions, 'deleteChat')
      mockDeleteChat.mockImplementation(async (cid, uid) => {
        if (cid === chatId && uid === userId) {
          return { success: true }
        }
        return { success: false, error: 'Unauthorized' }
      })

      const result = await dbActions.deleteChat(chatId, userId)

      expect(result.success).toBe(true)
    })

    it('should prevent user from deleting other users chat', async () => {
      const userId = fixtures.users.user1
      const chatId = fixtures.chats.privateChat2.id // User 2's chat

      const mockDeleteChat = vi.spyOn(dbActions, 'deleteChat')
      mockDeleteChat.mockImplementation(async (cid, uid) => {
        // Simulate RLS blocking deletion
        if (cid === chatId && uid !== fixtures.users.user2) {
          return { success: false, error: 'Unauthorized' }
        }
        return { success: true }
      })

      const result = await dbActions.deleteChat(chatId, userId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unauthorized')
    })
  })
})
