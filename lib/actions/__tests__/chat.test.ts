import { revalidateTag } from 'next/cache'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateChatTitle } from '@/lib/agents/title-generator'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import type { Chat, Message } from '@/lib/db/schema'
import type { UIMessage } from '@/lib/types/ai'

import {
  clearChats,
  createChat,
  createChatAndSaveMessage,
  createChatWithFirstMessage,
  deleteChat,
  deleteMessagesAfter,
  deleteMessagesFromIndex,
  getChats,
  getChatsPage,
  loadChat,
  saveChatTitle,
  shareChat,
  upsertMessage
} from '../chat'

// Mock the modules
vi.mock('@/lib/auth/get-current-user')
vi.mock('@/lib/db/actions')
vi.mock('@/lib/agents/title-generator')

describe('Chat Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getChats', () => {
    it('should return chats for authenticated user', async () => {
      const userId = 'user-123'
      const mockChats: Chat[] = [
        {
          id: 'chat-1',
          title: 'Chat 1',
          userId,
          visibility: 'private',
          createdAt: new Date()
        }
      ]

      vi.mocked(getCurrentUserId).mockResolvedValue(userId)
      vi.mocked(dbActions.getChats).mockResolvedValue(mockChats)

      const result = await getChats()

      expect(result).toEqual(mockChats)
      expect(dbActions.getChats).toHaveBeenCalledWith(userId)
    })

    it('should return empty array for unauthenticated user', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValue(undefined)

      const result = await getChats()

      expect(result).toEqual([])
      expect(dbActions.getChats).not.toHaveBeenCalled()
    })
  })

  describe('getChatsPage', () => {
    it('should return paginated chats for authenticated user', async () => {
      const userId = 'user-123'
      const mockResult = {
        chats: [
          {
            id: 'chat-1',
            title: 'Chat 1',
            userId,
            visibility: 'private' as const,
            createdAt: new Date()
          }
        ],
        nextOffset: 20
      }

      vi.mocked(getCurrentUserId).mockResolvedValue(userId)
      vi.mocked(dbActions.getChatsPage).mockResolvedValue(mockResult)

      const result = await getChatsPage(20, 0)

      expect(result).toEqual(mockResult)
      expect(dbActions.getChatsPage).toHaveBeenCalledWith(userId, 20, 0)
    })

    it('should return empty result for unauthenticated user', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValue(undefined)

      const result = await getChatsPage()

      expect(result).toEqual({ chats: [], nextOffset: null })
      expect(dbActions.getChatsPage).not.toHaveBeenCalled()
    })
  })

  describe('loadChat', () => {
    it('should load chat with messages', async () => {
      const chatId = 'chat-123'
      const userId = 'user-123'
      const mockChat = {
        id: chatId,
        title: 'Test Chat',
        userId,
        visibility: 'private' as const,
        createdAt: new Date(),
        messages: [
          {
            id: 'msg-1',
            role: 'user' as const,
            content: 'Hello',
            parts: []
          }
        ]
      }

      vi.mocked(dbActions.loadChatWithMessages).mockResolvedValue(mockChat)

      const result = await loadChat(chatId, userId)

      expect(result).toEqual(mockChat)
      expect(dbActions.loadChatWithMessages).toHaveBeenCalledWith(
        chatId,
        userId
      )
    })

    it('should load chat without userId for already authorized context', async () => {
      const chatId = 'chat-123'
      const mockChat = {
        id: chatId,
        title: 'Test Chat',
        userId: 'user-123',
        visibility: 'public' as const,
        createdAt: new Date(),
        messages: []
      }

      vi.mocked(dbActions.loadChatWithMessages).mockResolvedValue(mockChat)

      const result = await loadChat(chatId)

      expect(result).toEqual(mockChat)
      expect(dbActions.loadChatWithMessages).toHaveBeenCalledWith(
        chatId,
        undefined
      )
    })
  })

  describe('createChat', () => {
    it('should create a new chat with userId', async () => {
      const userId = 'user-123'
      const chatId = 'chat-123'
      const title = 'New Chat'
      const mockChat: Chat = {
        id: chatId,
        title,
        userId,
        visibility: 'private',
        createdAt: new Date()
      }

      vi.mocked(dbActions.createChat).mockResolvedValue(mockChat)
      vi.mocked(revalidateTag).mockReturnValue(undefined)

      const result = await createChat(chatId, title, userId)

      expect(result).toEqual(mockChat)
      expect(dbActions.createChat).toHaveBeenCalledWith({
        id: chatId,
        title,
        userId,
        visibility: 'private'
      })
      expect(revalidateTag).toHaveBeenCalledWith(`chat-${chatId}`)
      expect(revalidateTag).toHaveBeenCalledWith('chat')
    })

    it('should generate ID and use default title when not provided', async () => {
      const userId = 'user-123'
      const generatedId = 'generated-id-123'
      const mockChat: Chat = {
        id: generatedId,
        title: 'Untitled',
        userId,
        visibility: 'private',
        createdAt: new Date()
      }

      vi.mocked(dbActions.createChat).mockResolvedValue(mockChat)

      const result = await createChat(undefined, undefined, userId)

      expect(result).toEqual(mockChat)
      expect(dbActions.createChat).toHaveBeenCalledWith({
        id: expect.any(String),
        title: 'Untitled',
        userId,
        visibility: 'private'
      })
    })
  })

  describe('createChatAndSaveMessage', () => {
    it('should create chat and save message with authentication', async () => {
      const userId = 'user-123'
      const message: UIMessage = {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }]
      }
      const mockChat: Chat = {
        id: expect.any(String),
        title: 'Hello',
        userId,
        visibility: 'private',
        createdAt: new Date()
      }
      const mockMessage: Message = {
        id: 'msg-1',
        chatId: mockChat.id,
        role: 'user',
        metadata: {},
        createdAt: new Date(),
        updatedAt: null
      }

      vi.mocked(getCurrentUserId).mockResolvedValue(userId)
      vi.mocked(dbActions.createChat).mockResolvedValue(mockChat)
      vi.mocked(dbActions.upsertMessage).mockResolvedValue(mockMessage)

      const result = await createChatAndSaveMessage(message)

      expect(result.chat).toEqual(mockChat)
      expect(result.message).toEqual(mockMessage)
      expect(getCurrentUserId).toHaveBeenCalled()
    })

    it('should throw error for unauthenticated user', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValue(undefined)

      const message: UIMessage = {
        id: 'msg-1',
        role: 'user',
        parts: []
      }

      await expect(createChatAndSaveMessage(message)).rejects.toThrow(
        'User not authenticated'
      )
    })
  })

  describe('createChatWithFirstMessage', () => {
    it('should create chat with first message in transaction', async () => {
      const chatId = 'chat-123'
      const userId = 'user-123'
      const title = 'Test Chat'
      const message: UIMessage = {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }]
      }
      const mockResult = {
        chat: {
          id: chatId,
          title,
          userId,
          visibility: 'private' as const,
          createdAt: new Date()
        },
        message: {
          id: 'msg-1',
          chatId,
          role: 'user' as const,
          metadata: {},
          createdAt: new Date(),
          updatedAt: null
        }
      }

      vi.mocked(
        dbActions.createChatWithFirstMessageTransaction
      ).mockResolvedValue(mockResult)

      const result = await createChatWithFirstMessage(
        chatId,
        message,
        userId,
        title
      )

      expect(result).toEqual(mockResult)
      expect(
        dbActions.createChatWithFirstMessageTransaction
      ).toHaveBeenCalledWith({
        chatId,
        chatTitle: title,
        userId,
        message: {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      })
      expect(revalidateTag).toHaveBeenCalledWith(`chat-${chatId}`)
      expect(revalidateTag).toHaveBeenCalledWith('chat')
    })
  })

  describe('upsertMessage', () => {
    it('should upsert message without access check', async () => {
      const chatId = 'chat-123'
      const userId = 'user-123'
      const message: UIMessage = {
        id: 'msg-1',
        role: 'assistant',
        parts: []
      }
      const mockMessage: Message = {
        id: 'msg-1',
        chatId,
        role: 'assistant',
        metadata: {},
        createdAt: new Date(),
        updatedAt: null
      }

      vi.mocked(dbActions.upsertMessage).mockResolvedValue(mockMessage)

      const result = await upsertMessage(chatId, message, userId)

      expect(result).toEqual(mockMessage)
      expect(dbActions.upsertMessage).toHaveBeenCalledWith({
        ...message,
        id: 'msg-1',
        chatId
      })
      expect(revalidateTag).toHaveBeenCalledWith(`chat-${chatId}`)
    })

    it('should generate message ID if not provided', async () => {
      const chatId = 'chat-123'
      const userId = 'user-123'
      const message: UIMessage = {
        id: '', // Empty string will trigger ID generation
        role: 'user',
        parts: []
      }
      const mockMessage: Message = {
        id: 'generated-id',
        chatId,
        role: 'user',
        metadata: {},
        createdAt: new Date(),
        updatedAt: null
      }

      vi.mocked(dbActions.upsertMessage).mockResolvedValue(mockMessage)

      await upsertMessage(chatId, message, userId)

      expect(dbActions.upsertMessage).toHaveBeenCalledWith({
        ...message,
        id: expect.any(String),
        chatId
      })
    })
  })

  describe('deleteChat', () => {
    it('should delete chat for authenticated user', async () => {
      const chatId = 'chat-123'
      const userId = 'user-123'

      vi.mocked(getCurrentUserId).mockResolvedValue(userId)
      vi.mocked(dbActions.deleteChat).mockResolvedValue({ success: true })

      const result = await deleteChat(chatId)

      expect(result).toEqual({ success: true })
      expect(dbActions.deleteChat).toHaveBeenCalledWith(chatId, userId)
      expect(revalidateTag).toHaveBeenCalledWith(`chat-${chatId}`)
      expect(revalidateTag).toHaveBeenCalledWith('chat')
    })

    it('should return error for unauthenticated user', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValue(undefined)

      const result = await deleteChat('chat-123')

      expect(result).toEqual({
        success: false,
        error: 'User not authenticated'
      })
      expect(dbActions.deleteChat).not.toHaveBeenCalled()
    })
  })

  describe('clearChats', () => {
    it('should clear all chats for authenticated user', async () => {
      const userId = 'user-123'
      const mockChats: Chat[] = [
        {
          id: 'chat-1',
          title: 'Chat 1',
          userId,
          visibility: 'private',
          createdAt: new Date()
        },
        {
          id: 'chat-2',
          title: 'Chat 2',
          userId,
          visibility: 'private',
          createdAt: new Date()
        }
      ]

      vi.mocked(getCurrentUserId).mockResolvedValue(userId)
      vi.mocked(dbActions.getChats).mockResolvedValue(mockChats)
      vi.mocked(dbActions.deleteChat).mockResolvedValue({ success: true })

      const result = await clearChats()

      expect(result).toEqual({ success: true })
      expect(dbActions.deleteChat).toHaveBeenCalledTimes(2)
      expect(dbActions.deleteChat).toHaveBeenCalledWith('chat-1', userId)
      expect(dbActions.deleteChat).toHaveBeenCalledWith('chat-2', userId)
      expect(revalidateTag).toHaveBeenCalledWith('chat')
    })
  })

  describe('deleteMessagesAfter', () => {
    it('should delete messages after specified message', async () => {
      const chatId = 'chat-123'
      const messageId = 'msg-1'
      const userId = 'user-123'
      const mockChat: Chat = {
        id: chatId,
        title: 'Test Chat',
        userId,
        visibility: 'private',
        createdAt: new Date()
      }

      vi.mocked(getCurrentUserId).mockResolvedValue(userId)
      vi.mocked(dbActions.getChat).mockResolvedValue(mockChat)
      vi.mocked(dbActions.deleteMessagesAfter).mockResolvedValue({ count: 3 })

      const result = await deleteMessagesAfter(chatId, messageId)

      expect(result).toEqual({ success: true, count: 3 })
      expect(dbActions.deleteMessagesAfter).toHaveBeenCalledWith(
        chatId,
        messageId
      )
      expect(revalidateTag).toHaveBeenCalledWith(`chat-${chatId}`)
    })

    it('should return error for unauthorized access', async () => {
      const chatId = 'chat-123'
      const messageId = 'msg-1'
      const userId = 'user-123'
      const mockChat: Chat = {
        id: chatId,
        title: 'Test Chat',
        userId: 'other-user',
        visibility: 'private',
        createdAt: new Date()
      }

      vi.mocked(getCurrentUserId).mockResolvedValue(userId)
      vi.mocked(dbActions.getChat).mockResolvedValue(mockChat)

      const result = await deleteMessagesAfter(chatId, messageId)

      expect(result).toEqual({ success: false, error: 'Unauthorized' })
      expect(dbActions.deleteMessagesAfter).not.toHaveBeenCalled()
    })
  })

  describe('shareChat', () => {
    it('should update chat visibility to public', async () => {
      const chatId = 'chat-123'
      const userId = 'user-123'
      const mockChat: Chat = {
        id: chatId,
        title: 'Test Chat',
        userId,
        visibility: 'public',
        createdAt: new Date()
      }

      vi.mocked(getCurrentUserId).mockResolvedValue(userId)
      vi.mocked(dbActions.updateChatVisibility).mockResolvedValue(mockChat)

      const result = await shareChat(chatId)

      expect(result).toEqual(mockChat)
      expect(dbActions.updateChatVisibility).toHaveBeenCalledWith(
        chatId,
        userId,
        'public'
      )
      expect(revalidateTag).toHaveBeenCalledWith(`chat-${chatId}`)
    })

    it('should return null for unauthenticated user', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValue(undefined)

      const result = await shareChat('chat-123')

      expect(result).toBeNull()
      expect(dbActions.updateChatVisibility).not.toHaveBeenCalled()
    })
  })

  describe('deleteMessagesFromIndex', () => {
    it('should delete messages from specified index', async () => {
      const chatId = 'chat-123'
      const messageId = 'msg-2'
      const userId = 'user-123'
      const mockChat: Chat = {
        id: chatId,
        title: 'Test Chat',
        userId,
        visibility: 'private',
        createdAt: new Date()
      }

      vi.mocked(getCurrentUserId).mockResolvedValue(userId)
      vi.mocked(dbActions.getChat).mockResolvedValue(mockChat)
      vi.mocked(dbActions.deleteMessagesFromIndex).mockResolvedValue({
        count: 2
      })

      const result = await deleteMessagesFromIndex(chatId, messageId)

      expect(result).toEqual({ success: true, count: 2 })
      expect(dbActions.deleteMessagesFromIndex).toHaveBeenCalledWith(
        chatId,
        messageId
      )
      expect(revalidateTag).toHaveBeenCalledWith(`chat-${chatId}`)
    })
  })

  describe('saveChatTitle', () => {
    it('should generate and save title for new chat', async () => {
      const chatId = 'chat-123'
      const message: UIMessage = {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, how are you?' }]
      }
      const modelId = 'gpt-4'
      const generatedTitle = 'Greeting Conversation'

      vi.mocked(generateChatTitle).mockResolvedValue(generatedTitle)
      vi.mocked(dbActions.updateChatTitle).mockResolvedValue({
        id: chatId,
        title: generatedTitle,
        userId: 'user-123',
        visibility: 'private',
        createdAt: new Date()
      })

      await saveChatTitle(null, chatId, message, modelId)

      expect(generateChatTitle).toHaveBeenCalledWith({
        userMessageContent: 'Hello, how are you?',
        modelId,
        parentTraceId: undefined
      })
      expect(dbActions.updateChatTitle).toHaveBeenCalledWith(
        chatId,
        generatedTitle
      )
      expect(revalidateTag).toHaveBeenCalledWith(`chat-${chatId}`)
    })

    it('should not generate title for existing chat', async () => {
      const chat: Chat = {
        id: 'chat-123',
        title: 'Existing Chat',
        userId: 'user-123',
        visibility: 'private',
        createdAt: new Date()
      }
      const message: UIMessage = {
        id: 'msg-1',
        role: 'user',
        parts: []
      }

      await saveChatTitle(chat, 'chat-123', message, 'gpt-4')

      expect(generateChatTitle).not.toHaveBeenCalled()
      expect(dbActions.updateChatTitle).not.toHaveBeenCalled()
    })

    it('should not generate title when message is null', async () => {
      await saveChatTitle(null, 'chat-123', null, 'gpt-4')

      expect(generateChatTitle).not.toHaveBeenCalled()
      expect(dbActions.updateChatTitle).not.toHaveBeenCalled()
    })
  })
})
