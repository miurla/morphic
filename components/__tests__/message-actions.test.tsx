import React from 'react'

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('records one feedback control impression when the row becomes visible', () => {
    const { rerender } = render(
      <React.StrictMode>
        <MessageActions
          message="Answer"
          messageId="message-1"
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
          messageId="message-1"
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
      chatId: 'chat-1',
      isGuest: true
    })

    rerender(
      <React.StrictMode>
        <MessageActions
          className="parent-state-changed"
          message="Answer"
          messageId="message-1"
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

  test('records a missing trace id for a newly presented message', () => {
    const { rerender } = render(
      <MessageActions
        message="First answer"
        messageId="message-1"
        chatId="chat-1"
        status="ready"
        visible
      />
    )

    rerender(
      <MessageActions
        message="Second answer"
        messageId="message-2"
        chatId="chat-1"
        status="ready"
        visible
      />
    )

    expect(captureClient).toHaveBeenCalledTimes(2)
    expect(captureClient).toHaveBeenLastCalledWith('feedback_control_shown', {
      hasTraceId: false,
      chatId: 'chat-1',
      isGuest: false
    })
  })
})
