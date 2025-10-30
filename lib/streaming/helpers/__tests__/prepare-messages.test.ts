import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createChatWithFirstMessage,
  deleteMessagesFromIndex,
  loadChat,
  upsertMessage
} from '@/lib/actions/chat'
import type { Chat } from '@/lib/db/schema'
import type { UIMessage } from '@/lib/types/ai'

import { prepareMessages } from '../prepare-messages'
import type { StreamContext } from '../types'

// Mock dependencies
vi.mock('@/lib/actions/chat')
vi.mock('@/lib/db/schema', async () => {
  const actual = await vi.importActual('@/lib/db/schema')
  return {
    ...actual,
    generateId: vi.fn(() => 'generated-id-123')
  }
})

describe('prepareMessages', () => {
  const userId = 'user-123'
  const chatId = 'chat-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('regenerate-message trigger', () => {
    it('should reload chat after deleting assistant message', async () => {
      // Setup: Chat with 4 messages
      const initialChat: Chat & { messages: UIMessage[] } = {
        id: chatId,
        title: 'Test Chat',
        userId,
        visibility: 'private',
        createdAt: new Date(),
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 1' }]
          },
          {
            id: 'msg-2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Answer 1' }]
          },
          {
            id: 'msg-3',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 2' }]
          },
          {
            id: 'msg-4',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Answer 2' }]
          }
        ]
      }

      // After deletion, only messages 1-3 remain (but we only return 1)
      const updatedChat: Chat & { messages: UIMessage[] } = {
        ...initialChat,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 1' }]
          }
        ]
      }

      vi.mocked(deleteMessagesFromIndex).mockResolvedValue({
        success: true,
        count: 3
      })
      vi.mocked(loadChat).mockResolvedValue(updatedChat)

      const context: StreamContext = {
        chatId,
        userId,
        modelId: 'gpt-4',
        trigger: 'regenerate-message',
        messageId: 'msg-2',
        initialChat,
        isNewChat: false
      }

      const result = await prepareMessages(context, null)

      // Verify deleteMessagesFromIndex was called with correct message
      expect(deleteMessagesFromIndex).toHaveBeenCalledWith(
        chatId,
        'msg-2',
        userId
      )

      // Critical: loadChat should be called AFTER deletion to get fresh data
      expect(loadChat).toHaveBeenCalledWith(chatId, userId)

      // Verify only message 1 is returned (correct context for regeneration)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('msg-1')
    })

    it('should reload chat after deleting later assistant message', async () => {
      // Setup: Chat with 6 messages
      const initialChat: Chat & { messages: UIMessage[] } = {
        id: chatId,
        title: 'Test Chat',
        userId,
        visibility: 'private',
        createdAt: new Date(),
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 1' }]
          },
          {
            id: 'msg-2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Answer 1' }]
          },
          {
            id: 'msg-3',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 2' }]
          },
          {
            id: 'msg-4',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Answer 2' }]
          },
          {
            id: 'msg-5',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 3' }]
          },
          {
            id: 'msg-6',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Answer 3' }]
          }
        ]
      }

      // After deleting msg-4, messages 1-3 remain
      const updatedChat: Chat & { messages: UIMessage[] } = {
        ...initialChat,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 1' }]
          },
          {
            id: 'msg-2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Answer 1' }]
          },
          {
            id: 'msg-3',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 2' }]
          }
        ]
      }

      vi.mocked(deleteMessagesFromIndex).mockResolvedValue({
        success: true,
        count: 3
      })
      vi.mocked(loadChat).mockResolvedValue(updatedChat)

      const context: StreamContext = {
        chatId,
        userId,
        modelId: 'gpt-4',
        trigger: 'regenerate-message',
        messageId: 'msg-4',
        initialChat,
        isNewChat: false
      }

      const result = await prepareMessages(context, null)

      // Verify correct messages deleted
      expect(deleteMessagesFromIndex).toHaveBeenCalledWith(
        chatId,
        'msg-4',
        userId
      )

      // Critical: loadChat should be called to get updated state
      expect(loadChat).toHaveBeenCalledWith(chatId, userId)

      // Verify messages 1-3 are returned (correct context)
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('msg-1')
      expect(result[1].id).toBe('msg-2')
      expect(result[2].id).toBe('msg-3')
    })

    it('should handle user message edit and reload chat', async () => {
      // Setup: Chat with 4 messages
      const initialChat: Chat & { messages: UIMessage[] } = {
        id: chatId,
        title: 'Test Chat',
        userId,
        visibility: 'private',
        createdAt: new Date(),
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 1' }]
          },
          {
            id: 'msg-2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Answer 1' }]
          },
          {
            id: 'msg-3',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 2' }]
          },
          {
            id: 'msg-4',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Answer 2' }]
          }
        ]
      }

      const editedMessage: UIMessage = {
        id: 'msg-3',
        role: 'user',
        parts: [{ type: 'text', text: 'Edited Question 2' }]
      }

      // After editing msg-3, messages 1-3 remain (msg-4 deleted)
      const updatedChat: Chat & { messages: UIMessage[] } = {
        ...initialChat,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 1' }]
          },
          {
            id: 'msg-2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Answer 1' }]
          },
          {
            id: 'msg-3',
            role: 'user',
            parts: [{ type: 'text', text: 'Edited Question 2' }]
          }
        ]
      }

      vi.mocked(upsertMessage).mockResolvedValue({
        id: 'msg-3',
        chatId,
        role: 'user',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      })
      vi.mocked(deleteMessagesFromIndex).mockResolvedValue({
        success: true,
        count: 1
      })
      vi.mocked(loadChat).mockResolvedValue(updatedChat)

      const context: StreamContext = {
        chatId,
        userId,
        modelId: 'gpt-4',
        trigger: 'regenerate-message',
        messageId: 'msg-3',
        initialChat,
        isNewChat: false
      }

      const result = await prepareMessages(context, editedMessage)

      // Verify message was updated
      expect(upsertMessage).toHaveBeenCalledWith(chatId, editedMessage, userId)

      // Verify subsequent messages were deleted
      expect(deleteMessagesFromIndex).toHaveBeenCalledWith(
        chatId,
        'msg-4',
        userId
      )

      // Critical: loadChat should be called to get updated state
      expect(loadChat).toHaveBeenCalledWith(chatId, userId)

      // Verify updated messages are returned
      expect(result).toHaveLength(3)
      expect(result[2].parts[0]).toMatchObject({
        type: 'text',
        text: 'Edited Question 2'
      })
    })

    it('should throw error when no messages found in chat', async () => {
      const emptyChat: Chat & { messages: UIMessage[] } = {
        id: chatId,
        title: 'Empty Chat',
        userId,
        visibility: 'private',
        createdAt: new Date(),
        messages: []
      }

      const context: StreamContext = {
        chatId,
        userId,
        modelId: 'gpt-4',
        trigger: 'regenerate-message',
        messageId: 'msg-1',
        initialChat: emptyChat,
        isNewChat: false
      }

      await expect(prepareMessages(context, null)).rejects.toThrow(
        'No messages found'
      )
    })

    it('should use fallback when message not found by ID', async () => {
      const initialChat: Chat & { messages: UIMessage[] } = {
        id: chatId,
        title: 'Test Chat',
        userId,
        visibility: 'private',
        createdAt: new Date(),
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 1' }]
          },
          {
            id: 'msg-2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Answer 1' }]
          }
        ]
      }

      const updatedChat: Chat & { messages: UIMessage[] } = {
        ...initialChat,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Question 1' }]
          }
        ]
      }

      vi.mocked(deleteMessagesFromIndex).mockResolvedValue({
        success: true,
        count: 1
      })
      vi.mocked(loadChat).mockResolvedValue(updatedChat)

      const context: StreamContext = {
        chatId,
        userId,
        modelId: 'gpt-4',
        trigger: 'regenerate-message',
        messageId: 'non-existent-id',
        initialChat,
        isNewChat: false
      }

      const result = await prepareMessages(context, null)

      // Should fallback to last assistant message (msg-2)
      expect(deleteMessagesFromIndex).toHaveBeenCalled()
      expect(loadChat).toHaveBeenCalledWith(chatId, userId)
      expect(result).toHaveLength(1)
    })
  })

  describe('submit-message trigger', () => {
    it('should create new chat with first message optimistically', async () => {
      const newMessage: UIMessage = {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }]
      }

      vi.mocked(createChatWithFirstMessage).mockResolvedValue({
        chat: {
          id: chatId,
          title: 'Untitled',
          userId,
          visibility: 'private',
          createdAt: new Date()
        },
        message: {
          id: 'msg-1',
          chatId,
          role: 'user',
          metadata: {},
          createdAt: new Date(),
          updatedAt: null
        }
      })

      const context: StreamContext = {
        chatId,
        userId,
        modelId: 'gpt-4',
        trigger: 'submit-message',
        messageId: undefined,
        initialChat: null,
        isNewChat: true
      }

      const result = await prepareMessages(context, newMessage)

      // Verify message is returned immediately (optimistic)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('msg-1')

      // Verify persistence happens in background
      expect(context.pendingInitialSave).toBeDefined()
      expect(context.pendingInitialUserMessage).toEqual({
        ...newMessage,
        id: 'msg-1'
      })
    })

    it('should append message to existing chat', async () => {
      const existingChat: Chat & { messages: UIMessage[] } = {
        id: chatId,
        title: 'Existing Chat',
        userId,
        visibility: 'private',
        createdAt: new Date(),
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'First message' }]
          }
        ]
      }

      const newMessage: UIMessage = {
        id: 'msg-2',
        role: 'user',
        parts: [{ type: 'text', text: 'Second message' }]
      }

      vi.mocked(upsertMessage).mockResolvedValue({
        id: 'msg-2',
        chatId,
        role: 'user',
        metadata: {},
        createdAt: new Date(),
        updatedAt: null
      })

      const context: StreamContext = {
        chatId,
        userId,
        modelId: 'gpt-4',
        trigger: 'submit-message',
        messageId: undefined,
        initialChat: existingChat,
        isNewChat: false
      }

      const result = await prepareMessages(context, newMessage)

      // Verify message was saved
      expect(upsertMessage).toHaveBeenCalledWith(chatId, newMessage, userId)

      // Verify both messages are returned
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('msg-1')
      expect(result[1].id).toBe('msg-2')
    })
  })
})
