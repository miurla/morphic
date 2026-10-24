import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatHistoryClient } from '../chat-history-client'

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock })
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
      if (url.includes('include=reasoning')) {
        return {
          ok: true,
          json: async () => ({
            title: [],
            content: [],
            thinking: [
              {
                chatId: 'chat-9',
                title: 'Thinking match',
                snippet: 'pondering',
                highlight: 'pondering'
              }
            ]
          })
        }
      }
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

  it('refetches search results when chat data changes during search', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')
    fetchMock.mockClear()

    // Clear History (or any chat-data change) while searching: stale results
    // must not remain, so the search view refetches immediately.
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await flush(300)

    expect(calledWith(fetchMock, '/api/search')).toBe(true)
    expect(calledWith(fetchMock, '/api/chats')).toBe(false)
  })

  it('forwards ArrowDown and Enter from the input to the result list', async () => {
    mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')

    const input = screen.getByLabelText('Search history')
    // cmdk tracks the active item via aria-selected instead of DOM focus
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })
    expect(screen.getAllByRole('option')[0]).toHaveAttribute(
      'aria-selected',
      'true'
    )

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(pushMock).toHaveBeenCalledWith('/search/chat-9')
  })

  it('does not forward Enter or Escape while an IME composition is active', async () => {
    mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')

    const input = screen.getByLabelText('Search history')
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })
    expect(screen.getAllByRole('option')[0]).toHaveAttribute(
      'aria-selected',
      'true'
    )

    // Enter confirms an IME candidate and Escape cancels it; neither may
    // reach the result list or clear the query while composing.
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    })
    expect(pushMock).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape', isComposing: true })
    })
    expect(screen.getByLabelText('Search history')).toHaveValue('mat')
  })

  it('keeps thinking results when chat data changes during search', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Search thinking/ }))
    })
    await flush(50)
    expect(screen.getByText('Thinking match')).toBeInTheDocument()

    // A chat finishing (or Clear History) must not drop the thinking
    // section: both result sets are refetched in place.
    fetchMock.mockClear()
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await flush(300)

    expect(screen.getByText('Thinking match')).toBeInTheDocument()
    expect(calledWith(fetchMock, '/api/search?q=mat&include=reasoning')).toBe(
      true
    )
  })
})
