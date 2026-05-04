import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the modules before any imports
vi.mock('@/lib/supabase/admin')
vi.mock('langfuse')
vi.mock('@/lib/utils/telemetry')

// Import after mocking
import { Langfuse } from 'langfuse'

import { createAdminClient } from '@/lib/supabase/admin'
import { isTracingEnabled } from '@/lib/utils/telemetry'

import { getMessageFeedback, updateMessageFeedback } from '../feedback'

describe('Feedback Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const makeSupabaseMock = (selectResult: any, updateResult: any = undefined) => {
    const singleSelect = vi.fn().mockResolvedValue(selectResult)
    const eqSelect = vi.fn().mockReturnValue({ single: singleSelect })
    const selectChain = vi.fn().mockReturnValue({ eq: eqSelect })
    const fromSelect = vi.fn().mockReturnValue({ select: selectChain })

    const eqUpdate = vi.fn().mockResolvedValue(updateResult ?? { error: null })
    const setChain = vi.fn().mockReturnValue({ eq: eqUpdate })
    const fromUpdate = vi.fn().mockReturnValue({ update: setChain })

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'messages') {
          return {
            select: selectChain,
            update: setChain
          }
        }
        return { select: selectChain }
      })
    }

    vi.mocked(createAdminClient).mockReturnValue(mock as any)
    return mock
  }

  describe('updateMessageFeedback', () => {
    it('should update message feedback successfully', async () => {
      const messageId = 'test-message-id'
      const score = 1

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { metadata: { traceId: 'test-trace-id' }, chat_id: 'test-chat-id' },
                error: null
              })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(supabase as any)
      vi.mocked(isTracingEnabled).mockReturnValue(false)

      const result = await updateMessageFeedback(messageId, score)

      expect(result).toEqual({ success: true })
    })

    it('should return error when message not found', async () => {
      const messageId = 'non-existent-id'
      const score = 1

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
            })
          })
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

      const result = await updateMessageFeedback(messageId, score)

      expect(result).toEqual({ success: false, error: 'Message not found' })
    })

    it('should handle errors gracefully', async () => {
      const messageId = 'test-message-id'
      const score = -1

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockRejectedValue(new Error('Database error'))
            })
          })
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

      const result = await updateMessageFeedback(messageId, score)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
    })

    it('should send feedback to Langfuse when tracing is enabled', async () => {
      const messageId = 'test-message-id'
      const score = 1

      vi.mocked(isTracingEnabled).mockReturnValue(true)

      const mockScore = vi.fn()
      const mockFlush = vi.fn().mockResolvedValue(undefined)
      vi.mocked(Langfuse).mockImplementation(
        () => ({ score: mockScore, flushAsync: mockFlush }) as any
      )

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { metadata: { traceId: 'test-trace-id' }, chat_id: 'test-chat-id' },
                error: null
              })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

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

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { metadata: { feedbackScore } },
                error: null
              })
            })
          })
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

      const result = await getMessageFeedback(messageId)

      expect(result).toBe(feedbackScore)
    })

    it('should return null when message not found', async () => {
      const messageId = 'non-existent-id'

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
            })
          })
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

      const result = await getMessageFeedback(messageId)

      expect(result).toBeNull()
    })

    it('should return null when no feedback score exists', async () => {
      const messageId = 'test-message-id'

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { metadata: {} }, error: null })
            })
          })
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

      const result = await getMessageFeedback(messageId)

      expect(result).toBeNull()
    })

    it('should handle errors and return null', async () => {
      const messageId = 'test-message-id'

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockRejectedValue(new Error('Database error'))
            })
          })
        })
      }

      vi.mocked(createAdminClient).mockReturnValue(supabase as any)

      const result = await getMessageFeedback(messageId)

      expect(result).toBeNull()
    })
  })
})
