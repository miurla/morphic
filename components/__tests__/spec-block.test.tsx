import { StrictMode } from 'react'

import type { Spec } from '@json-render/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { captureClient } from '@/lib/analytics/posthog-client'
import { ChatProvider } from '@/lib/contexts/chat-context'

import { SpecBlock, SpecMessageContext } from '../spec-block'

vi.mock('@/lib/analytics/posthog-client', () => ({
  captureClient: vi.fn(),
  chatIdFromPath: () => 'chat-1'
}))

const sendMessage = vi.fn()
const isStreamingRef = { current: false }
function spec(revise = true): Spec {
  return {
    root: 'main',
    elements: {
      main: { type: 'Stack', props: {}, children: ['h', 'q1', 'q2'] },
      h: { type: 'Heading', props: { title: revise ? 'Revise' : 'Related' } },
      q1: {
        type: 'Button',
        props: { text: '末尾だけ別案を3つ見る', variant: 'link' },
        on: {
          press: {
            action: revise ? 'submitRevision' : 'submitQuery',
            params: {
              query: '末尾だけ3案。冒頭とFAQと500語の条件は維持。',
              intent: 'alternatives'
            }
          }
        }
      },
      q2: {
        type: 'Button',
        props: { text: '末尾だけ書き換える', variant: 'link' },
        on: {
          press: {
            action: revise ? 'submitRevision' : 'submitQuery',
            params: {
              query: '末尾だけ柔らかく。冒頭とFAQと500語は維持。',
              intent: 'edit'
            }
          }
        }
      }
    }
  }
}
function view(value = spec(), messageId = 'answer-1') {
  return (
    <StrictMode>
      <ChatProvider sendMessage={sendMessage} isStreamingRef={isStreamingRef}>
        <SpecMessageContext.Provider value={messageId}>
          <SpecBlock result={{ status: 'ready', spec: value, source: '' }} />
        </SpecMessageContext.Provider>
      </ChatProvider>
    </StrictMode>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  isStreamingRef.current = false
})

describe('Revise actions and analytics', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('waits for viewport intersection and does not recount visibility changes', () => {
    const callbacks: IntersectionObserverCallback[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          callbacks.push(callback)
        }
        observe() {}
        disconnect() {}
      }
    )
    render(view())
    expect(captureClient).not.toHaveBeenCalled()
    const callback = callbacks.at(-1)!
    callback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
    expect(captureClient).not.toHaveBeenCalled()
    callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
    callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
    expect(captureClient).toHaveBeenCalledTimes(2)
  })

  test('uses the latest query and message despite ActionProvider retaining its first handlers', async () => {
    const { rerender } = render(view())
    const updated = spec()
    updated.elements.q1.on!.press = {
      action: 'submitRevision',
      params: { query: 'Updated ending request', intent: 'alternatives' }
    }
    rerender(view(updated, 'answer-2'))
    fireEvent.click(screen.getByText('末尾だけ別案を3つ見る'))
    await waitFor(() => expect(sendMessage).toHaveBeenCalledOnce())
    expect(sendMessage.mock.calls[0][0].parts[0].text).toContain(
      'Updated ending request'
    )
    expect(captureClient).toHaveBeenLastCalledWith(
      'revise_suggestion_clicked',
      expect.objectContaining({ messageId: 'answer-2' })
    )
  })

  test('counts each rendered suggestion once across strict effects and rerenders, without content', () => {
    const { rerender } = render(view())
    rerender(view(spec()))
    expect(captureClient).toHaveBeenCalledTimes(2)
    expect(captureClient).toHaveBeenNthCalledWith(
      1,
      'revise_suggestion_shown',
      {
        chatId: 'chat-1',
        messageId: 'answer-1',
        suggestionId: 'revise-1',
        position: 0,
        intent: 'alternatives'
      }
    )
    expect(captureClient).toHaveBeenNthCalledWith(
      2,
      'revise_suggestion_shown',
      {
        chatId: 'chat-1',
        messageId: 'answer-1',
        suggestionId: 'revise-2',
        position: 1,
        intent: 'edit'
      }
    )
    expect(JSON.stringify(vi.mocked(captureClient).mock.calls)).not.toMatch(
      /末尾|query|label|prompt/
    )
  })

  test('previews in chat with scope and protected constraints', async () => {
    render(view())
    fireEvent.click(screen.getByText('末尾だけ別案を3つ見る'))
    await waitFor(() => expect(sendMessage).toHaveBeenCalledOnce())
    const text = sendMessage.mock.calls[0][0].parts[0].text
    expect(text).toContain('Do not call editDraft or write a draft block')
    expect(text).toContain('select and explicitly request application')
    expect(text).toContain('冒頭とFAQと500語')
    expect(captureClient).toHaveBeenLastCalledWith(
      'revise_suggestion_clicked',
      {
        chatId: 'chat-1',
        messageId: 'answer-1',
        suggestionId: 'revise-1',
        position: 0,
        intent: 'alternatives'
      }
    )
  })

  test('sends an explicit scoped edit', async () => {
    render(view())
    fireEvent.click(screen.getByText('末尾だけ書き換える'))
    await waitFor(() => expect(sendMessage).toHaveBeenCalledOnce())
    expect(sendMessage.mock.calls[0][0].parts[0].text).toContain(
      'Leave all other text unchanged'
    )
    expect(sendMessage.mock.calls[0][0].parts[0].text).toContain(
      '末尾だけ柔らかく'
    )
    expect(captureClient).toHaveBeenLastCalledWith(
      'revise_suggestion_clicked',
      expect.objectContaining({ intent: 'edit', position: 1 })
    )
  })

  test('rejects a click during generation without counting it, including after rerender', async () => {
    const { rerender } = render(view())
    isStreamingRef.current = true
    rerender(view())
    vi.mocked(captureClient).mockClear()
    fireEvent.click(screen.getByText('末尾だけ別案を3つ見る'))
    await Promise.resolve()
    expect(sendMessage).not.toHaveBeenCalled()
    expect(captureClient).not.toHaveBeenCalled()
  })

  test.each(['修正', 'Related', undefined])(
    'handles revision actions under heading %s with both intents and streaming protection',
    async heading => {
      const value = spec()
      if (heading === undefined) {
        value.elements.main.children = ['q1', 'q2']
      } else {
        value.elements.h.props.title = heading
      }
      render(view(value))
      expect(captureClient).toHaveBeenCalledTimes(2)
      fireEvent.click(screen.getByText('末尾だけ別案を3つ見る'))
      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
      expect(sendMessage.mock.calls[0][0].parts[0].text).toContain(
        'Do not call editDraft or write a draft block'
      )
      expect(captureClient).toHaveBeenLastCalledWith(
        'revise_suggestion_clicked',
        expect.objectContaining({ intent: 'alternatives' })
      )
      fireEvent.click(screen.getByText('末尾だけ書き換える'))
      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2))
      expect(sendMessage.mock.calls[1][0].parts[0].text).toContain(
        'Leave all other text unchanged'
      )
      expect(captureClient).toHaveBeenLastCalledWith(
        'revise_suggestion_clicked',
        expect.objectContaining({ intent: 'edit' })
      )
      isStreamingRef.current = true
      vi.mocked(captureClient).mockClear()
      fireEvent.click(screen.getByText('末尾だけ別案を3つ見る'))
      await Promise.resolve()
      expect(sendMessage).toHaveBeenCalledTimes(2)
      expect(captureClient).not.toHaveBeenCalled()
    }
  )

  test('keeps the legacy Related event and query', async () => {
    render(view(spec(false)))
    expect(captureClient).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('末尾だけ別案を3つ見る'))
    await waitFor(() => expect(sendMessage).toHaveBeenCalledOnce())
    expect(sendMessage.mock.calls[0][0].parts[0].text).toBe(
      '末尾だけ3案。冒頭とFAQと500語の条件は維持。'
    )
    expect(captureClient).toHaveBeenCalledExactlyOnceWith(
      'related_question_clicked',
      { chatId: 'chat-1' }
    )
  })

  test('classifies saved Revise submitQuery buttons as legacy without guessing intent', async () => {
    const saved = spec()
    saved.elements.q1.on!.press = {
      action: 'submitQuery',
      params: { query: 'Original saved query' }
    }
    render(view(saved))
    fireEvent.click(screen.getByText('末尾だけ別案を3つ見る'))
    await waitFor(() => expect(sendMessage).toHaveBeenCalledOnce())
    expect(sendMessage.mock.calls[0][0].parts[0].text).toBe(
      'Original saved query'
    )
    expect(captureClient).toHaveBeenLastCalledWith(
      'revise_suggestion_clicked',
      expect.objectContaining({ intent: 'legacy' })
    )
  })
})
