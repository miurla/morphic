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

let lastObserver: IntersectionObserverStub | null = null
class IntersectionObserverStub {
  constructor(private callback: IntersectionObserverCallback) {
    lastObserver = this
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  // Simulate the sentinel entering the viewport
  intersect() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    )
  }
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

  it('counts code points, not UTF-16 code units, for the minimum', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)
    fetchMock.mockClear()

    // '😀' is two code units but one character: like any single-character
    // query it must keep the chronological list instead of a broad search.
    await typeInSearch('😀')
    expect(screen.getByText('Existing chat')).toBeInTheDocument()
    expect(calledWith(fetchMock, '/api/search')).toBe(false)

    // two characters (even both non-BMP) do enter search mode
    await typeInSearch('😀😀')
    expect(screen.getByText('Matched chat')).toBeInTheDocument()
  })

  it('refreshes the hidden list immediately when chat data changes while searching', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)
    fetchMock.mockClear()

    await typeInSearch('mat')

    // A chat completes (or Clear History) while the user is searching: the
    // hidden list refetches right away, so deleted chats can never be
    // revealed as clickable items when the user leaves search mode.
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await flush(50)
    expect(calledWith(fetchMock, '/api/chats')).toBe(true)

    // Leaving the search shows the refreshed list, not stale items.
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'))
    })
    await flush(50)
    expect(screen.getByText('Existing chat')).toBeInTheDocument()
  })

  it('retries a failed hidden refresh when search mode ends', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')
    fetchMock.mockClear()

    // Clear History while searching, but the hidden list refresh fails:
    // the deleted chats must not simply be revealed when the user exits.
    fetchMock.mockImplementationOnce(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/chats')) {
        return {
          ok: false,
          json: async () => ({ chats: [], nextOffset: null })
        }
      }
      return { ok: true, json: async () => ({ title: [], content: [] }) }
    })
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await flush(50)
    const chatsCalls = () =>
      fetchMock.mock.calls.filter(([url]) =>
        String(url).startsWith('/api/chats')
      ).length
    expect(chatsCalls()).toBe(1)

    // Exiting search retries the failed refresh; the retry succeeds here,
    // so the fresh list replaces the stale (deleted) items.
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'))
    })
    await flush(50)
    expect(chatsCalls()).toBe(2)
    expect(screen.getByText('Existing chat')).toBeInTheDocument()
  })

  it('marks the list stale when a hidden refresh fails after the query is cleared', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')
    fetchMock.mockClear()

    // The refresh starts while search mode hides the list, but the user
    // clears the query before the failing response lands: the failure
    // counts as a hidden-refresh failure (mode at request start, not at
    // completion) and must still be retried.
    fetchMock.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return { ok: false, json: async () => ({ chats: [], nextOffset: null }) }
    })
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'))
    })
    await flush(200)
    const chatsCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith('/api/chats')
    ).length
    expect(chatsCalls).toBe(2)
    expect(screen.getByText('Existing chat')).toBeInTheDocument()
  })

  it('keeps the list suppressed while a hidden refresh is still pending on exit', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')
    fetchMock.mockClear()

    // Clear History while searching; the hidden refresh stays pending
    // (slow response) and the user exits search before it settles. The
    // list is already stale from the deletion, so the old links must not
    // be clickable until a refresh succeeds.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/chats')) {
        await new Promise(resolve => setTimeout(resolve, 100))
        return {
          ok: true,
          json: async () => ({ chats: [chat], nextOffset: null })
        }
      }
      return { ok: true, json: async () => ({ title: [], content: [] }) }
    })
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'))
    })
    await flush(50) // still pending
    expect(screen.queryByText('Existing chat')).not.toBeInTheDocument()

    await flush(150)
    expect(screen.getByText('Existing chat')).toBeInTheDocument()
  })

  it('offers a retry instead of stale chats when the exit retry also fails', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')
    fetchMock.mockClear()

    const failChats = async () => ({
      ok: false,
      json: async () => ({ chats: [], nextOffset: null })
    })
    fetchMock.mockImplementationOnce(failChats)
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await flush(50)

    // The retry issued on leaving search mode fails too (outage spanning
    // both requests): the deleted chats must stay hidden behind an
    // actionable retry instead of reappearing.
    fetchMock.mockImplementationOnce(failChats)
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'))
    })
    await flush(50)
    expect(screen.queryByText('Existing chat')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

    // Recovering now, the manual retry shows the fresh list.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    })
    await flush(50)
    expect(screen.getByText('Existing chat')).toBeInTheDocument()
  })

  it('ignores a superseded refresh when a newer one fails', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')
    fetchMock.mockClear()

    // Two data changes while the list is hidden. The first refresh is slow
    // and would succeed with a response captured before the second change;
    // the second refresh fails. Only the latest request may apply its data
    // or move the suppression flags.
    let chatsCalls = 0
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/chats')) {
        chatsCalls++
        if (chatsCalls === 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
          return {
            ok: true,
            json: async () => ({ chats: [chat], nextOffset: null })
          }
        }
        return {
          ok: false,
          json: async () => ({ chats: [], nextOffset: null })
        }
      }
      return { ok: true, json: async () => ({ title: [], content: [] }) }
    })
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await flush(50) // the newer refresh has failed; the older is pending

    // Leaving search retries the failed refresh (which fails here too).
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'))
    })
    await flush(50)
    expect(screen.queryByText('Existing chat')).not.toBeInTheDocument()

    // The older response lands: it predates the second change, so it must
    // not clear the suppression or reveal its (stale) items.
    await flush(100)
    expect(screen.queryByText('Existing chat')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('surfaces a visible-mode failure that supersedes a pending hidden refresh', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')
    fetchMock.mockClear()

    // The hidden refresh and the exit retry are both slow and still
    // pending when a chat finishes in normal mode; that third request
    // supersedes both and fails. The failure must surface as the retry
    // error state, not leave an endless skeleton.
    let chatsCalls = 0
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/chats')) {
        chatsCalls++
        if (chatsCalls <= 2) {
          await new Promise(resolve => setTimeout(resolve, 100))
          return {
            ok: true,
            json: async () => ({ chats: [chat], nextOffset: null })
          }
        }
        if (chatsCalls === 3) {
          return {
            ok: false,
            json: async () => ({ chats: [], nextOffset: null })
          }
        }
        return {
          ok: true,
          json: async () => ({ chats: [chat], nextOffset: null })
        }
      }
      return { ok: true, json: async () => ({ title: [], content: [] }) }
    })
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    // Leaving search starts the exit retry (still pending)...
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'))
    })
    // ...and a chat finishing in normal mode supersedes both, then fails.
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await flush(50)
    expect(screen.queryByText('Existing chat')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

    // The two superseded successes land; they must not clear the error.
    await flush(100)
    expect(screen.queryByText('Existing chat')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

    // The manual retry recovers.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    })
    await flush(50)
    expect(screen.getByText('Existing chat')).toBeInTheDocument()
  })

  it('discards a load-more page superseded by a refresh', async () => {
    const deletedChat = {
      id: 'chat-old',
      title: 'Deleted chat',
      userId: 'user-1',
      visibility: 'private' as const,
      createdAt: new Date('2026-01-01T00:00:00Z')
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/chats?offset=0')) {
        return {
          ok: true,
          json: async () => ({ chats: [chat], nextOffset: 20 })
        }
      }
      if (url.startsWith('/api/chats')) {
        await new Promise(resolve => setTimeout(resolve, 400))
        return {
          ok: true,
          json: async () => ({ chats: [deletedChat], nextOffset: null })
        }
      }
      return { ok: true, json: async () => ({ title: [], content: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ChatHistoryClient />)
    await flush(50)
    expect(screen.getByText('Existing chat')).toBeInTheDocument()

    // Start infinite scroll (its page is slow), then enter search mode:
    // the observer disconnects but the request stays in flight.
    lastObserver!.intersect()
    await typeInSearch('mat')

    // Clear History while hidden: the refresh succeeds and replaces the
    // list; the stale load-more page must not append to it afterwards.
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await flush(50)
    await flush(400) // the stale page lands while the list is hidden

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'))
    })
    await flush(50)
    expect(screen.getByText('Existing chat')).toBeInTheDocument()
    expect(screen.queryByText('Deleted chat')).not.toBeInTheDocument()
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
    // the hidden chronological list refreshes alongside the results
    expect(calledWith(fetchMock, '/api/chats')).toBe(true)
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

  it('mirrors the result list onto the input with combobox ARIA', async () => {
    mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    const input = screen.getByLabelText('Search history')
    // Outside search mode there is no popup list to point at.
    expect(input).toHaveAttribute('role', 'combobox')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).not.toHaveAttribute('aria-controls')

    await typeInSearch('mat')
    expect(input).toHaveAttribute('aria-expanded', 'true')
    const list = document.querySelector('[cmdk-list]') as HTMLElement
    expect(list).toBeTruthy()
    expect(input.getAttribute('aria-controls')).toBe(list.id)

    // After keyboard navigation the active option is referenced so screen
    // readers announce it while DOM focus stays on the input.
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })
    const active = document.querySelector(
      '[cmdk-item][data-selected="true"]'
    ) as HTMLElement
    expect(active).toBeTruthy()
    expect(input.getAttribute('aria-activedescendant')).toBe(active.id)

    // Leaving search mode removes the relationships again.
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    expect(input).not.toHaveAttribute('aria-controls')
    expect(input).not.toHaveAttribute('aria-activedescendant')
  })

  it('lets Enter activate the thinking button instead of the selected result', async () => {
    const fetchMock = mockFetch()
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

    // The button lives inside the cmdk root; its Enter must press the button,
    // not activate the selected result through cmdk's root handler. cmdk's
    // handler cancels the keydown (preventDefault) to suppress the native
    // click, so a non-cancelled event proves a real browser would press the
    // button instead of opening the selected result.
    let notCancelled = false
    await act(async () => {
      notCancelled = fireEvent.keyDown(
        screen.getByRole('button', { name: /Search thinking/ }),
        {
          key: 'Enter'
        }
      )
    })
    expect(notCancelled).toBe(true)
    expect(pushMock).not.toHaveBeenCalled()

    // jsdom does not run the keydown's default action, so fire the click a
    // real browser would produce and assert the thinking search starts.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Search thinking/ }))
    })
    await flush(50)
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('include=reasoning')
      )
    ).toBe(true)
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('drops the mirrored active option when results are invalidated', async () => {
    mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')
    const input = screen.getByLabelText('Search history')
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy()

    // Clear History invalidates the results; the removed option must not
    // stay referenced by the input, even if the refetch fails or is empty.
    await act(async () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    })
    await flush(50) // still inside the debounce window: options are gone
    expect(input).not.toHaveAttribute('aria-activedescendant')
  })

  it('drops the mirrored active option when the query changes', async () => {
    mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    await typeInSearch('mat')
    const input = screen.getByLabelText('Search history')
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy()

    // Editing to a new query unmounts the options; the removed option must
    // not stay referenced during the debounce window (or indefinitely if
    // the new search returns nothing).
    await act(async () => {
      fireEvent.change(input, { target: { value: 'mat2' } })
    })
    await flush(50) // still inside the debounce window: no new options yet
    expect(input).not.toHaveAttribute('aria-activedescendant')
  })

  it('bounds a pasted query before putting it in the search URL', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    // 204 characters: the URL must carry the same bounded query the backend
    // would apply, so oversized pastes cannot exceed the request-target limit
    await typeInSearch('note '.repeat(40) + 'kiwi')

    const url = fetchMock.mock.calls
      .map(([u]) => String(u))
      .find(u => u.startsWith('/api/search'))
    expect(url).toBeTruthy()
    expect(
      new URL(url as string, 'http://localhost').searchParams.get('q')
    ).toBe('note '.repeat(40).trim())
  })

  it('keeps the chronological list when normalization drops the query below the minimum', async () => {
    mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    // 'a ' + a 300-char token: the bound drops the partial second token,
    // leaving one character — too short to search, so the list stays
    await typeInSearch('a ' + 'x'.repeat(300))

    expect(screen.getByText('Existing chat')).toBeInTheDocument()
  })

  it('searches a paste whose cap split falls inside a surrogate pair', async () => {
    const fetchMock = mockFetch()
    render(<ChatHistoryClient />)
    await flush(50)

    // the 200-code-unit cut lands inside an emoji; without the surrogate
    // backoff, encodeURIComponent throws and no request is ever issued
    await typeInSearch('a' + '😀'.repeat(100))

    expect(calledWith(fetchMock, '/api/search')).toBe(true)
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

    // Some browser/IME combinations only signal composition via keyCode 229.
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
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
