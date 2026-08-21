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

  test('does not record an event when the feedback control is shown', () => {
    render(
      <MessageActions
        message="Answer"
        messageId="feedback-shown-1"
        traceId="trace-1"
        chatId="chat-1"
        status="ready"
        visible
      />
    )

    expect(captureClient).not.toHaveBeenCalled()
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
