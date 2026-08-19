import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { captureClient } from '@/lib/analytics/posthog-client'

import { MessageActions } from '../message-actions'

vi.mock('@/lib/analytics/posthog-client', () => ({
  captureClient: vi.fn()
}))

vi.mock('../library/library-context', () => ({
  useLibrary: () => ({
    openLibrary: vi.fn(),
    upsertCachedNote: vi.fn()
  })
}))

describe('MessageActions', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('records one feedback control impression when the row becomes visible', () => {
    const { rerender } = render(
      <React.StrictMode>
        <MessageActions
          message="Answer"
          messageId="visible-1"
          traceId="trace-1"
          chatId="chat-1"
          isGuest
          status="streaming"
          visible={false}
        />
      </React.StrictMode>
    )

    expect(captureClient).not.toHaveBeenCalled()

    rerender(
      <React.StrictMode>
        <MessageActions
          message="Answer"
          messageId="visible-1"
          traceId="trace-1"
          chatId="chat-1"
          isGuest
          status="ready"
          visible
        />
      </React.StrictMode>
    )

    expect(captureClient).toHaveBeenCalledTimes(1)
    expect(captureClient).toHaveBeenCalledWith('feedback_control_shown', {
      hasTraceId: true,
      hasFeedback: false,
      chatId: 'chat-1',
      isGuest: true
    })

    rerender(
      <React.StrictMode>
        <MessageActions
          className="parent-state-changed"
          message="Answer"
          messageId="visible-1"
          traceId="trace-1"
          chatId="chat-1"
          isGuest
          status="ready"
          visible
        />
      </React.StrictMode>
    )

    expect(captureClient).toHaveBeenCalledTimes(1)
  })

  test('does not record a second impression when the same message remounts', () => {
    const props = {
      message: 'Answer',
      messageId: 'remount-1',
      traceId: 'trace-1',
      chatId: 'chat-1',
      status: 'ready' as const,
      visible: true
    }

    const first = render(<MessageActions {...props} />)
    expect(captureClient).toHaveBeenCalledTimes(1)

    // Reopening a conversation remounts every past answer.
    first.unmount()
    render(<MessageActions {...props} />)

    expect(captureClient).toHaveBeenCalledTimes(1)
  })

  test('reports a message that already carries a score as such', () => {
    render(
      <MessageActions
        message="Answer"
        messageId="scored-1"
        traceId="trace-1"
        feedbackScore={-1}
        chatId="chat-1"
        status="ready"
        visible
      />
    )

    expect(captureClient).toHaveBeenCalledWith('feedback_control_shown', {
      hasTraceId: true,
      hasFeedback: true,
      chatId: 'chat-1',
      isGuest: false
    })
  })

  test('records a missing trace id for a newly presented message', () => {
    render(
      <MessageActions
        message="First answer"
        messageId="no-trace-1"
        chatId="chat-1"
        status="ready"
        visible
      />
    )

    expect(captureClient).toHaveBeenCalledTimes(1)
    expect(captureClient).toHaveBeenLastCalledWith('feedback_control_shown', {
      hasTraceId: false,
      hasFeedback: false,
      chatId: 'chat-1',
      isGuest: false
    })
  })

  test('records a thumbs up click and successful feedback response', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response)
    render(
      <MessageActions
        message="Answer"
        messageId="feedback-success-1"
        traceId="trace-1"
        chatId="chat-1"
        isGuest
        status="ready"
        visible
      />
    )
    vi.mocked(captureClient).mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Good response' }))

    await waitFor(() => {
      expect(captureClient).toHaveBeenCalledTimes(2)
    })
    expect(captureClient).toHaveBeenNthCalledWith(
      1,
      'feedback_control_clicked',
      {
        score: 1,
        chatId: 'chat-1',
        isGuest: true
      }
    )
    expect(captureClient).toHaveBeenNthCalledWith(2, 'feedback_recorded', {
      score: 1,
      chatId: 'chat-1',
      isGuest: true
    })
  })

  test('records a failed feedback response', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 503
    } as Response)
    render(
      <MessageActions
        message="Answer"
        messageId="feedback-response-failure-1"
        traceId="trace-1"
        chatId="chat-1"
        status="ready"
        visible
      />
    )
    vi.mocked(captureClient).mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Good response' }))

    await waitFor(() => {
      expect(captureClient).toHaveBeenCalledTimes(2)
    })
    expect(captureClient).toHaveBeenNthCalledWith(
      1,
      'feedback_control_clicked',
      {
        score: 1,
        chatId: 'chat-1',
        isGuest: false
      }
    )
    expect(captureClient).toHaveBeenNthCalledWith(2, 'feedback_failed', {
      score: 1,
      chatId: 'chat-1',
      isGuest: false,
      status: 503,
      reason: 'response'
    })
  })

  test('records an exception when feedback submission throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
    render(
      <MessageActions
        message="Answer"
        messageId="feedback-exception-1"
        traceId="trace-1"
        chatId="chat-1"
        status="ready"
        visible
      />
    )
    vi.mocked(captureClient).mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Good response' }))

    await waitFor(() => {
      expect(captureClient).toHaveBeenCalledTimes(2)
    })
    expect(captureClient).toHaveBeenNthCalledWith(
      1,
      'feedback_control_clicked',
      {
        score: 1,
        chatId: 'chat-1',
        isGuest: false
      }
    )
    expect(captureClient).toHaveBeenNthCalledWith(2, 'feedback_failed', {
      score: 1,
      chatId: 'chat-1',
      isGuest: false,
      reason: 'exception'
    })
  })
})
