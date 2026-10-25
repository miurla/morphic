import { act, fireEvent, render, screen } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HL_START, HL_STOP } from '@/lib/render/highlight-markers'

import { ChatHistorySearch } from '../chat-history-search'

const pushMock = vi.hoisted(() => vi.fn())

// jsdom lacks ResizeObserver, which cmdk requires
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock })
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() }
}))

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: async () => body })
}

const emptyResponse = { title: [], content: [] }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => {
    resolve = res
  })
  return { promise, resolve }
}

// Advance fake timers inside act() so React flushes state updates that
// happen in promise continuations started by the timers.
async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function typeQuery(ui: ReturnType<typeof render>, query: string) {
  await act(async () => {
    ui.rerender(<ChatHistorySearch query={query} />)
  })
  await flush(300)
}

describe('ChatHistorySearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not search for queries shorter than 2 characters', async () => {
    const fetchMock = vi.fn().mockReturnValue(jsonResponse(emptyResponse))
    vi.stubGlobal('fetch', fetchMock)

    render(<ChatHistorySearch query="r" />)
    await flush(500)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('debounces the request by ~250ms', async () => {
    const fetchMock = vi.fn().mockReturnValue(jsonResponse(emptyResponse))
    vi.stubGlobal('fetch', fetchMock)

    render(<ChatHistorySearch query="ro" />)
    await flush(200)
    expect(fetchMock).not.toHaveBeenCalled()

    await flush(100)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/api/search?q=ro')
  })

  it('drops a stale response that arrives after a newer query resolved', async () => {
    const robResponse = deferred<unknown>()
    const robertResponse = deferred<unknown>()
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(robResponse.promise)
      .mockReturnValueOnce(robertResponse.promise)
    vi.stubGlobal('fetch', fetchMock)

    const ui = render(<ChatHistorySearch query="rob" />)
    await flush(300)

    await typeQuery(ui, 'robert')

    await act(async () => {
      robertResponse.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          title: [],
          content: [
            {
              chatId: 'c2',
              title: 'Robert Frost',
              snippet: 'robert',
              highlight: `${HL_START}robert${HL_STOP}`
            }
          ]
        })
      })
    })
    expect(screen.getByText('Robert Frost')).toBeInTheDocument()

    // The superseded "rob" response arrives late and must not overwrite.
    await act(async () => {
      robResponse.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          title: [],
          content: [
            {
              chatId: 'c1',
              title: 'Rob Reiner',
              snippet: 'rob',
              highlight: `${HL_START}rob${HL_STOP}`
            }
          ]
        })
      })
    })

    expect(screen.queryByText('Rob Reiner')).not.toBeInTheDocument()
    expect(screen.getByText('Robert Frost')).toBeInTheDocument()
  })

  it('renders By title and In chats sections with highlighted snippets', async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        title: [{ chatId: 'c1', title: 'Robert Frost Readings' }],
        content: [
          {
            chatId: 'c2',
            title: 'Poetry class',
            snippet: 'Stopping by woods',
            highlight: `Stopping by ${HL_START}woods${HL_STOP}`
          }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ChatHistorySearch query="woods" />)
    await flush(300)

    expect(screen.getByText('By title')).toBeInTheDocument()
    expect(screen.getByText('In chats')).toBeInTheDocument()
    expect(screen.getByText('Robert Frost Readings')).toBeInTheDocument()
    const bold = screen.getByText('woods')
    expect(bold.tagName).toBe('B')
  })

  it('opens the chat when a result is activated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        jsonResponse({
          title: [{ chatId: 'c1', title: 'Robert Frost Readings' }],
          content: []
        })
      )
    )

    render(<ChatHistorySearch query="frost" />)
    await flush(300)

    fireEvent.click(screen.getByText('Robert Frost Readings'))

    expect(pushMock).toHaveBeenCalledWith('/search/c1')
  })

  it('shows a No matches empty state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(jsonResponse(emptyResponse)))

    render(<ChatHistorySearch query="zzz" />)
    await flush(300)

    expect(screen.getByText('No matches')).toBeInTheDocument()
  })

  it('shows an error toast when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(jsonResponse({}, false, 500))
    )

    render(<ChatHistorySearch query="frost" />)
    await flush(300)

    expect(toast.error).toHaveBeenCalled()
  })

  it('appends an In thinking section on opt-in and resets it on a new query', async () => {
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(
        jsonResponse({
          title: [],
          content: [
            { chatId: 'c1', title: 'Chat A', snippet: 'x', highlight: 'x' }
          ]
        })
      )
      .mockReturnValueOnce(
        jsonResponse({
          title: [],
          content: [],
          thinking: [
            {
              chatId: 'c9',
              title: 'Deep chat',
              snippet: 'pondering quasars',
              highlight: `pondering ${HL_START}quasars${HL_STOP}`
            }
          ]
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const ui = render(<ChatHistorySearch query="quasars" />)
    await flush(300)
    expect(screen.getByText('Chat A')).toBeInTheDocument()
    expect(screen.queryByText('In thinking')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Search thinking/ }))
    })
    await flush(50)

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('include=reasoning'),
      expect.anything()
    )
    expect(screen.getByText('In thinking')).toBeInTheDocument()
    expect(screen.getByText('Deep chat')).toBeInTheDocument()

    // A new query resets the thinking scope: section gone, button back.
    await typeQuery(ui, 'quasars again')
    expect(screen.queryByText('In thinking')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Search thinking/ })
    ).toBeInTheDocument()
  })

  it('keeps thinking results when the main response resolves after them', async () => {
    const mainResponse = deferred<unknown>()
    const thinkingResponse = deferred<unknown>()
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(mainResponse.promise)
      .mockReturnValueOnce(thinkingResponse.promise)
    vi.stubGlobal('fetch', fetchMock)

    render(<ChatHistorySearch query="quasars" />)
    await flush(300)

    // The user opts in before the main response has resolved.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Search thinking/ }))
    })

    await act(async () => {
      thinkingResponse.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          title: [],
          content: [],
          thinking: [
            {
              chatId: 'c9',
              title: 'Deep chat',
              snippet: 'pondering quasars',
              highlight: `pondering ${HL_START}quasars${HL_STOP}`
            }
          ]
        })
      })
    })
    expect(screen.getByText('In thinking')).toBeInTheDocument()

    // The main response arrives late and must not drop the thinking section.
    await act(async () => {
      mainResponse.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          title: [],
          content: [
            { chatId: 'c1', title: 'Chat A', snippet: 'x', highlight: 'x' }
          ]
        })
      })
    })

    expect(screen.getByText('Chat A')).toBeInTheDocument()
    expect(screen.getByText('In thinking')).toBeInTheDocument()
    expect(screen.getByText('Deep chat')).toBeInTheDocument()
  })

  it('aborts an in-flight thinking request on unmount', async () => {
    const thinkingResponse = deferred<unknown>()
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(jsonResponse(emptyResponse))
      .mockReturnValueOnce(thinkingResponse.promise)
    vi.stubGlobal('fetch', fetchMock)

    const ui = render(<ChatHistorySearch query="quasars" />)
    await flush(300)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Search thinking/ }))
    })
    const thinkingSignal = (
      fetchMock.mock.calls[1][1] as { signal: AbortSignal }
    ).signal
    expect(thinkingSignal.aborted).toBe(false)

    ui.unmount()

    expect(thinkingSignal.aborted).toBe(true)
  })

  it('re-enables the thinking button when the query changes mid-request', async () => {
    const thinkingResponse = deferred<unknown>()
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(jsonResponse(emptyResponse))
      .mockReturnValueOnce(thinkingResponse.promise)
      .mockReturnValue(jsonResponse(emptyResponse))
    vi.stubGlobal('fetch', fetchMock)

    const ui = render(<ChatHistorySearch query="quasars" />)
    await flush(300)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Search thinking/ }))
    })
    expect(
      screen.getByRole('button', { name: /Search thinking/ })
    ).toBeDisabled()

    // Changing the query aborts the thinking request; the stale response
    // must not leave the button stuck in the loading state.
    await typeQuery(ui, 'quasars again')

    expect(
      screen.getByRole('button', { name: /Search thinking/ })
    ).toBeEnabled()
  })

  it('renders literal HTML in snippets as plain text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        jsonResponse({
          title: [],
          content: [
            {
              chatId: 'c1',
              title: 'HTML chat',
              snippet: 'use <b>bold</b> tags',
              highlight: `use <b>bold</b> ${HL_START}tags${HL_STOP}`
            }
          ]
        })
      )
    )

    render(<ChatHistorySearch query="tags" />)
    await flush(300)

    expect(screen.getByText('tags').tagName).toBe('B')
    expect(screen.getByText(/use <b>bold<\/b>/)).toBeInTheDocument()
  })

  it('does not rerun the thinking search when the epoch bump lands with a query change', async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        title: [{ chatId: 'c1', title: 'Chat A' }],
        content: []
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const ui = render(<ChatHistorySearch query="quasars" refreshKey={0} />)
    await flush(300)

    // Opt in to thinking search for the current query.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Search thinking/ }))
    })
    await flush(50)
    const thinkingCalls = () =>
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('include=reasoning')
      ).length
    expect(thinkingCalls()).toBe(1)

    // The epoch bump lands in the same render as a query change. The opt-in
    // belongs to the previous query (its reset has not applied yet), so the
    // refresh must not carry it over to the new query.
    await act(async () => {
      ui.rerender(<ChatHistorySearch query="quasars!" refreshKey={1} />)
    })
    await flush(300)

    expect(thinkingCalls()).toBe(1)
    expect(screen.queryByText('In thinking')).not.toBeInTheDocument()
  })

  it('invalidates stale results on refresh and does not restore them on failure', async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        title: [{ chatId: 'c1', title: 'Budget chat' }],
        content: []
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const ui = render(<ChatHistorySearch query="budget" refreshKey={0} />)
    await flush(300)
    expect(screen.getByText('Budget chat')).toBeInTheDocument()

    // A refreshKey bump (e.g. Clear History) must invalidate the displayed
    // matches immediately; a failed refetch must not bring them back.
    fetchMock.mockReturnValue(jsonResponse({}, false, 500))
    await act(async () => {
      ui.rerender(<ChatHistorySearch query="budget" refreshKey={1} />)
    })
    await flush(50) // still inside the debounce window
    expect(screen.queryByText('Budget chat')).not.toBeInTheDocument()

    await flush(300) // debounce fires and the fetch fails
    expect(screen.queryByText('Budget chat')).not.toBeInTheDocument()

    // A later successful refresh repopulates the results.
    fetchMock.mockReturnValue(
      jsonResponse({
        title: [{ chatId: 'c2', title: 'Fresh chat' }],
        content: []
      })
    )
    await act(async () => {
      ui.rerender(<ChatHistorySearch query="budget" refreshKey={2} />)
    })
    await flush(300)
    expect(screen.getByText('Fresh chat')).toBeInTheDocument()
  })
})
