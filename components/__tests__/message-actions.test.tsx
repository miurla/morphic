import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { saveNote } from '@/lib/actions/notes'
import { captureClient } from '@/lib/analytics/posthog-client'

import { MessageActions } from '../message-actions'

vi.mock('@/lib/analytics/posthog-client', () => ({
  captureClient: vi.fn()
}))

vi.mock('@/lib/actions/notes', () => ({
  saveNote: vi.fn()
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

  test('renders the save control in the same action group as copy', () => {
    const { container } = render(
      <MessageActions
        message="Answer"
        messageId="save-group-1"
        status="ready"
        visible
      />
    )

    const saveButton = screen.getByRole('button', {
      name: 'Save to library'
    })
    const copyButton = container
      .querySelector('.tabler-icon-copy')
      ?.closest('button')

    expect(copyButton).toBeTruthy()
    expect(saveButton.parentElement).toBe(copyButton?.parentElement)
  })

  test('does not render the save control when the library is unavailable', () => {
    render(
      <MessageActions
        message="Answer"
        messageId="save-unavailable-1"
        libraryAvailable={false}
        status="ready"
        visible
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Save to library' })
    ).not.toBeInTheDocument()
  })

  test('does not render the save control for a local guest', () => {
    render(
      <MessageActions
        message="Answer"
        messageId="save-local-guest-1"
        isGuest
        status="ready"
        visible
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Save to library' })
    ).not.toBeInTheDocument()
  })

  test('opens the auth dialog for a cloud guest', () => {
    render(
      <MessageActions
        message="Answer"
        messageId="save-cloud-guest-1"
        isGuest
        isCloudDeployment
        status="ready"
        visible
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save to library' }))

    expect(
      screen.getByRole('heading', { name: 'Save notes to your library' })
    ).toBeInTheDocument()
    expect(saveNote).not.toHaveBeenCalled()
  })

  test('saves the message from the save control', async () => {
    vi.mocked(saveNote).mockResolvedValue({ success: true })
    render(
      <MessageActions
        message="Answer"
        messageId="save-message-1"
        chatId="chat-1"
        status="ready"
        visible
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save to library' }))

    await waitFor(() => {
      expect(saveNote).toHaveBeenCalledWith({
        content: 'Answer',
        chatId: 'chat-1',
        sourceMessageId: 'save-message-1'
      })
    })
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
