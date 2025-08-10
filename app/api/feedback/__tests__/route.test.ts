import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the modules
vi.mock('@/lib/actions/feedback', () => ({
  updateMessageFeedback: vi.fn()
}))

vi.mock('@/lib/utils/telemetry', () => ({
  isTracingEnabled: vi.fn(() => false)
}))

vi.mock('langfuse', () => ({
  Langfuse: vi.fn(() => ({
    score: vi.fn(),
    flushAsync: vi.fn(() => Promise.resolve())
  }))
}))

// Import after mocking
import { Langfuse } from 'langfuse'

import { updateMessageFeedback } from '@/lib/actions/feedback'
import { isTracingEnabled } from '@/lib/utils/telemetry'

import { POST } from '../route'

describe('Feedback API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/feedback', () => {
    it('should record feedback successfully', async () => {
      vi.mocked(isTracingEnabled).mockReturnValue(true)
      vi.mocked(updateMessageFeedback).mockResolvedValue({
        success: true
      })

      const mockScore = vi.fn()
      const mockFlush = vi.fn().mockResolvedValue(undefined)
      vi.mocked(Langfuse).mockImplementation(
        () =>
          ({
            score: mockScore,
            flushAsync: mockFlush
          }) as any
      )

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          traceId: 'test-trace-id',
          score: 1,
          comment: 'Great!',
          messageId: 'test-message-id'
        })
      })

      const response = await POST(request)
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(text).toBe('Feedback recorded successfully')
      expect(mockScore).toHaveBeenCalledWith({
        traceId: 'test-trace-id',
        name: 'user_feedback',
        value: 1,
        comment: 'Great!'
      })
      expect(mockFlush).toHaveBeenCalled()
      expect(updateMessageFeedback).toHaveBeenCalledWith('test-message-id', 1)
    })

    it('should handle negative feedback', async () => {
      vi.mocked(isTracingEnabled).mockReturnValue(true)
      vi.mocked(updateMessageFeedback).mockResolvedValue({
        success: true
      })

      const mockScore = vi.fn()
      const mockFlush = vi.fn().mockResolvedValue(undefined)
      vi.mocked(Langfuse).mockImplementation(
        () =>
          ({
            score: mockScore,
            flushAsync: mockFlush
          }) as any
      )

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          traceId: 'test-trace-id',
          score: -1,
          messageId: 'test-message-id'
        })
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockScore).toHaveBeenCalledWith({
        traceId: 'test-trace-id',
        name: 'user_feedback',
        value: -1,
        comment: undefined
      })
    })

    it('should return 400 for missing traceId', async () => {
      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          score: 1,
          messageId: 'test-message-id'
        })
      })

      const response = await POST(request)
      const text = await response.text()

      expect(response.status).toBe(400)
      expect(text).toBe('traceId is required')
    })

    it('should return 400 for invalid score', async () => {
      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          traceId: 'test-trace-id',
          score: 0,
          messageId: 'test-message-id'
        })
      })

      const response = await POST(request)
      const text = await response.text()

      expect(response.status).toBe(400)
      expect(text).toBe('score must be 1 (good) or -1 (bad)')
    })

    it('should return 200 when tracing is disabled', async () => {
      vi.mocked(isTracingEnabled).mockReturnValue(false)

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          traceId: 'test-trace-id',
          score: 1,
          messageId: 'test-message-id'
        })
      })

      const response = await POST(request)
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(text).toBe('Feedback tracking is not enabled')
      expect(updateMessageFeedback).not.toHaveBeenCalled()
    })

    it('should continue even if database update fails', async () => {
      vi.mocked(isTracingEnabled).mockReturnValue(true)
      vi.mocked(updateMessageFeedback).mockResolvedValue({
        success: false,
        error: 'Database error'
      })

      const mockScore = vi.fn()
      const mockFlush = vi.fn().mockResolvedValue(undefined)
      vi.mocked(Langfuse).mockImplementation(
        () =>
          ({
            score: mockScore,
            flushAsync: mockFlush
          }) as any
      )

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          traceId: 'test-trace-id',
          score: 1,
          messageId: 'test-message-id'
        })
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating message feedback:',
        'Database error'
      )

      consoleErrorSpy.mockRestore()
    })

    it('should work without messageId', async () => {
      vi.mocked(isTracingEnabled).mockReturnValue(true)

      const mockScore = vi.fn()
      const mockFlush = vi.fn().mockResolvedValue(undefined)
      vi.mocked(Langfuse).mockImplementation(
        () =>
          ({
            score: mockScore,
            flushAsync: mockFlush
          }) as any
      )

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          traceId: 'test-trace-id',
          score: 1
        })
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(updateMessageFeedback).not.toHaveBeenCalled()
    })

    it('should handle JSON parsing errors', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      })

      const response = await POST(request)
      const text = await response.text()

      expect(response.status).toBe(500)
      expect(text).toBe('Error recording feedback')
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })
})
