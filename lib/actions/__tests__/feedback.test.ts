import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the modules before any imports
vi.mock('@/lib/db')
vi.mock('@/lib/cache/memory-cache')
vi.mock('langfuse')
vi.mock('@/lib/utils/telemetry')

// Import after mocking
import { chatCache } from '@/lib/cache/memory-cache'
import { db } from '@/lib/db'
import { isTracingEnabled } from '@/lib/utils/telemetry'
import { Langfuse } from 'langfuse'

import { getMessageFeedback, updateMessageFeedback } from '../feedback'

describe('Feedback Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateMessageFeedback', () => {
    it('should update message feedback successfully', async () => {
      const messageId = 'test-message-id'
      const chatId = 'test-chat-id'
      const score = 1

      // Mock db.select
      const mockLimit = vi.fn().mockResolvedValue([
        {
          metadata: { traceId: 'test-trace-id' },
          chatId
        }
      ])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      // Mock db.update
      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined)
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
      vi.mocked(db).update = vi.fn().mockReturnValue({ set: mockSet })

      // Mock cache
      vi.mocked(chatCache).deletePattern = vi.fn()

      // Mock tracing disabled
      vi.mocked(isTracingEnabled).mockReturnValue(false)

      const result = await updateMessageFeedback(messageId, score)

      expect(result).toEqual({ success: true })
      expect(db.select).toHaveBeenCalled()
      expect(db.update).toHaveBeenCalled()
      expect(chatCache.deletePattern).toHaveBeenCalledWith(`${chatId}-`)
    })

    it('should return error when message not found', async () => {
      const messageId = 'non-existent-id'
      const score = 1

      // Mock empty database response
      const mockLimit = vi.fn().mockResolvedValue([])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      const result = await updateMessageFeedback(messageId, score)

      expect(result).toEqual({
        success: false,
        error: 'Message not found'
      })
    })

    it('should handle errors gracefully', async () => {
      const messageId = 'test-message-id'
      const score = -1

      // Mock database error
      const mockLimit = vi.fn().mockRejectedValue(new Error('Database error'))
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      const result = await updateMessageFeedback(messageId, score)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
    })

    it('should send feedback to Langfuse when tracing is enabled', async () => {
      const messageId = 'test-message-id'
      const chatId = 'test-chat-id'
      const score = 1

      // Enable tracing
      vi.mocked(isTracingEnabled).mockReturnValue(true)

      // Mock Langfuse
      const mockScore = vi.fn()
      const mockFlush = vi.fn().mockResolvedValue(undefined)
      vi.mocked(Langfuse).mockImplementation(
        () =>
          ({
            score: mockScore,
            flushAsync: mockFlush
          }) as any
      )

      // Mock db.select
      const mockLimit = vi.fn().mockResolvedValue([
        {
          metadata: { traceId: 'test-trace-id' },
          chatId
        }
      ])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      // Mock db.update
      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined)
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
      vi.mocked(db).update = vi.fn().mockReturnValue({ set: mockSet })

      // Mock cache
      vi.mocked(chatCache).deletePattern = vi.fn()

      const result = await updateMessageFeedback(messageId, score)

      expect(result).toEqual({ success: true })
      expect(Langfuse).toHaveBeenCalled()
      expect(mockScore).toHaveBeenCalledWith({
        traceId: 'test-trace-id',
        name: 'user-feedback',
        value: score,
        comment: 'Thumbs up'
      })
      expect(mockFlush).toHaveBeenCalled()
    })
  })

  describe('getMessageFeedback', () => {
    it('should retrieve feedback score successfully', async () => {
      const messageId = 'test-message-id'
      const feedbackScore = 1

      // Mock database response
      const mockLimit = vi.fn().mockResolvedValue([
        {
          metadata: { feedbackScore }
        }
      ])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      const result = await getMessageFeedback(messageId)

      expect(result).toBe(feedbackScore)
    })

    it('should return null when message not found', async () => {
      const messageId = 'non-existent-id'

      // Mock empty database response
      const mockLimit = vi.fn().mockResolvedValue([])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      const result = await getMessageFeedback(messageId)

      expect(result).toBeNull()
    })

    it('should return null when no feedback score exists', async () => {
      const messageId = 'test-message-id'

      // Mock database response without feedbackScore
      const mockLimit = vi.fn().mockResolvedValue([
        {
          metadata: {}
        }
      ])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      const result = await getMessageFeedback(messageId)

      expect(result).toBeNull()
    })

    it('should handle errors and return null', async () => {
      const messageId = 'test-message-id'

      // Mock database error
      const mockLimit = vi.fn().mockRejectedValue(new Error('Database error'))
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db).select = vi.fn().mockReturnValue({ from: mockFrom })

      const result = await getMessageFeedback(messageId)

      expect(result).toBeNull()
    })
  })
})