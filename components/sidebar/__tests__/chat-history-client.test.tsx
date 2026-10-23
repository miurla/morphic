import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatHistoryClient } from '../chat-history-client'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('../chat-menu-item', () => ({
  ChatMenuItem: ({ chat }: { chat: { id: string; title: string } }) => (
    <div data-testid="chat-item">{chat.title}</div>
  )
}))

vi.mock('../clear-history-action', () => ({
  ClearHistoryAction: () => <button type="button">Clear history</button>
}))

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver =
  IntersectionObserverStub as unknown as typeof IntersectionObserver

// jsdom lacks ResizeObserver, which cmdk requires
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver

const chat = {
  id: 'chat-1',
  title: 'Existing chat',
  userId: 'user-1',
  visibility: 'private' as const,
  createdAt: new Date('2026-01-01T00:00:00Z')
}

function mockFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith('/api/chats')) {
      return {
        ok: true,
        json: async () => ({ chats: [chat], nextOffset: null })
      }
    }
    if (url.startsWith('/api/search')) {
      return {
        ok: true,
        json: async () => ({
          title: [{ chatId: 'chat-9', title: 'Matched chat' }],
          content: []
        })
      }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function flush(ms = 0) {
  await act(async () => {
    if (ms > 0) {
      await vi.advanceTimersByTimeAsync(ms)
    } else {
      await Promise.resolve()
    }
  })
}

function calledWith(fetchMock: ReturnType<typeof mockFetch>, prefix: string) {
  return fetchMock.mock.calls.some(([url]) => String(url).startsWith(prefix))
}

async function typeInSearch(query: string) {
  const input = screen.getByLabelText('Search history')
  await act(async () => {
    fireEvent.change(input, { target: { value: query } })
  })
  await flush(300)
}

describe('ChatHistoryClient search mode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('swaps the list for results while searching and restores it on Escape', async () => {
    mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    expect(screen.getByText('Existing chat')).toBeInTheDocument()

    await typeInSearch('mat')
    expect(screen.queryByText('Existing chat')).not.toBeInTheDocument()
    expect(screen.getByText('Matched chat')).toBeInTheDocument()

    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Search history'), {
        key: 'Escape'
      })
    })
    expect(screen.getByText('Existing chat')).toBeInTheDocument()
    expect(screen.queryByText('Matched chat')).not.toBeInTheDocument()
  })

  it('keeps the list visible for queries shorter than 2 characters', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('m')
    expect(screen.getByText('Existing chat')).toBeInTheDocument()
    expect(calledWith(fetchMock, '/api/search')).toBe(false)
  })

  it('defers chat-history-updated refreshes while searching and applies them on exit', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)
    fetchMock.mockClear()

    await typeInSearch('mat')

    // A chat completes while the user is searching: the list must not refetch.
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await flush(50)
    expect(calledWith(fetchMock, '/api/chats')).toBe(false)

    // Clearing the search applies the deferred refresh.
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'))
    })
    await flush(50)
    expect(calledWith(fetchMock, '/api/chats')).toBe(true)
    expect(screen.getByText('Existing chat')).toBeInTheDocument()
  })
})
