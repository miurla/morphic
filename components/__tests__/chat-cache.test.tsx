import {
  createContext,
  type MutableRefObject,
  StrictMode,
  useContext
} from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { summarizeGenui } from '@/lib/analytics/genui-summary'
import { captureClient } from '@/lib/analytics/posthog-client'
import { chatStore } from '@/lib/chat-store'
import { useChatContext } from '@/lib/contexts/chat-context'
import type { UIMessage } from '@/lib/types/ai'

import { Chat } from '../chat'

const RefreshContext = createContext<(() => Promise<void>) | null>(null)
const streamingRefs: MutableRefObject<boolean>[] = []

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/lib/analytics/genui-summary', () => ({ summarizeGenui: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/contexts/app-user-context', () => ({
  useAppUser: () => ({ id: 'owner' })
}))
vi.mock('@/lib/analytics/posthog-client', () => ({
  getDistinctId: () => 'visitor',
  captureClient: vi.fn()
}))
vi.mock('@/hooks/use-file-dropzone', () => ({ useFileDropzone: () => ({}) }))
vi.mock('../draft/draft-store', () => ({
  registerDraftSource: vi.fn(),
  unregisterDraftSource: vi.fn()
}))
vi.mock('../chat-messages', () => ({
  ChatMessages: ({ sections, reload, onUpdateMessage }: any) => (
    <div>
      {JSON.stringify(sections)}
      <button onClick={() => reload('seed')}>Reload</button>
      <button onClick={() => onUpdateMessage('seed', 'edited')}>Edit</button>
    </div>
  )
}))
vi.mock('../chat-panel', () => ({
  ChatPanel: ({
    disabled,
    isHistoryPending,
    messages,
    append,
    onNewChat,
    stop,
    input,
    handleInputChange,
    handleSubmit
  }: any) => {
    const { isStreamingRef } = useChatContext()
    if (!streamingRefs.includes(isStreamingRef))
      streamingRefs.push(isStreamingRef)
    return (
      <div>
        {!isHistoryPending && messages.length === 0 && (
          <h1>What would you like to know?</h1>
        )}
        <button disabled={disabled} onClick={() => append({ text: 'hello' })}>
          Send
        </button>
        <button onClick={onNewChat}>New</button>
        <button onClick={stop}>Stop</button>
        <form onSubmit={handleSubmit}>
          <textarea
            aria-label="Message"
            value={input}
            onChange={handleInputChange}
          />
          <button type="submit">Submit</button>
        </form>
      </div>
    )
  }
}))
vi.mock('../drag-overlay', () => ({ DragOverlay: () => null }))
vi.mock('../error-modal', () => ({
  ErrorModal: ({ open, error }: any) =>
    open ? <div role="dialog">{error.type}</div> : null
}))
vi.mock('../usage-budget-provider', () => ({
  UsageBudgetWarning: () => null,
  useUsageBudget: () => {
    const refreshUsage = useContext(RefreshContext)
    return { enabled: !!refreshUsage, refreshUsage }
  }
}))

const messages = (text: string): UIMessage[] => [
  { id: text, role: 'user', parts: [{ type: 'text', text }] }
]
const reply = (text: string) =>
  new Response(JSON.stringify({ messages: messages(text) }))

describe('Chat client cache', () => {
  beforeEach(() => {
    chatStore.clear()
    streamingRefs.length = 0
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply('server')))
  })
  afterEach(() => {
    chatStore.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const finishResponse = () =>
    new Response(
      'data: {"type":"start","messageId":"answer"}\n\ndata: {"type":"finish","finishReason":"stop"}\n\ndata: [DONE]\n\n',
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'x-vercel-ai-ui-message-stream': 'v1'
        }
      }
    )

  const mountSharedChat = (
    refreshUsage = vi.fn().mockResolvedValue(undefined)
  ) => {
    const view = render(
      <RefreshContext.Provider value={refreshUsage}>
        <Chat id="shared" savedMessages={messages('seed')} />
      </RefreshContext.Provider>
    )
    return { ...view, refreshUsage }
  }

  it.each(['Send', 'Reload', 'Edit'])(
    'keeps finish callbacks with the first component after %s',
    async action => {
      let resolve!: (response: Response) => void
      vi.mocked(fetch).mockReturnValueOnce(
        new Promise(r => {
          resolve = r
        })
      )
      vi.mocked(summarizeGenui).mockReturnValueOnce({
        blockCount: 1,
        contentBlockCount: 1,
        imageCount: 0,
        hasImage: false,
        hasRelated: false,
        componentTypes: ['Text']
      })
      const first = mountSharedChat()
      const second = mountSharedChat()
      await act(async () => {
        fireEvent.click(within(first.container).getByText(action))
      })
      expect(streamingRefs[0].current).toBe(true)
      expect(chatStore.get('shared')!.chat.status).toBe('submitted')
      await act(async () => {
        resolve(finishResponse())
      })
      await waitFor(() => expect(first.refreshUsage).toHaveBeenCalledOnce())
      expect(second.refreshUsage).not.toHaveBeenCalled()
      expect(captureClient).toHaveBeenCalledOnce()
      expect(streamingRefs.map(ref => ref.current)).toEqual([false, false])
    }
  )

  it('does not steal callbacks when another component mounts during a turn', async () => {
    let resolve!: (response: Response) => void
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise(r => {
        resolve = r
      })
    )
    const first = mountSharedChat()
    await act(async () => {
      fireEvent.click(within(first.container).getByText('Send'))
    })
    const owner = chatStore.get('shared')!.handlers.current
    const second = mountSharedChat()
    expect(chatStore.get('shared')!.handlers.current).toBe(owner)
    second.unmount()
    expect(chatStore.get('shared')!.handlers.current).toBe(owner)
    await act(async () => {
      resolve(finishResponse())
    })
    await waitFor(() => expect(first.refreshUsage).toHaveBeenCalledOnce())
    expect(second.refreshUsage).not.toHaveBeenCalled()
    first.unmount()
    expect(chatStore.get('shared')!.handlers.current).toEqual({})
  })

  it.each([
    ['rate-limit', 'rate_limit', 429],
    ['auth', 'auth_required', 401],
    ['forbidden', 'forbidden', 403]
  ] as const)(
    'shows a %s modal only in the sending component',
    async (type, code, status) => {
      let resolve!: (response: Response) => void
      vi.mocked(fetch).mockReturnValueOnce(
        new Promise(r => {
          resolve = r
        })
      )
      const first = mountSharedChat()
      const second = mountSharedChat()
      await act(async () => {
        fireEvent.click(within(first.container).getByText('Send'))
      })
      expect(streamingRefs[0].current).toBe(true)
      await act(async () => {
        resolve(
          new Response(
            JSON.stringify({ error: 'Request failed', type, code }),
            { status }
          )
        )
      })
      expect(
        await within(first.container).findByRole('dialog')
      ).toHaveTextContent(type)
      expect(
        within(second.container).queryByRole('dialog')
      ).not.toBeInTheDocument()
      expect(first.refreshUsage).toHaveBeenCalledOnce()
      expect(second.refreshUsage).not.toHaveBeenCalled()
      expect(streamingRefs.map(ref => ref.current)).toEqual([false, false])
    }
  )

  it('shows a general error toast once for the sending component', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'Request failed',
          type: 'general',
          code: 'unknown'
        }),
        { status: 500 }
      )
    )
    const first = mountSharedChat()
    const second = mountSharedChat()
    await act(async () => {
      fireEvent.click(within(first.container).getByText('Send'))
    })
    await waitFor(() => expect(toast.error).toHaveBeenCalledOnce())
    expect(first.refreshUsage).toHaveBeenCalledOnce()
    expect(second.refreshUsage).not.toHaveBeenCalled()
    expect(captureClient).not.toHaveBeenCalled()
    expect(streamingRefs.map(ref => ref.current)).toEqual([false, false])
  })

  it.each(['ready', 'error'])(
    'clears stale streaming refs in every component on %s',
    async status => {
      mountSharedChat()
      mountSharedChat()
      const chat = chatStore.get('shared')!.chat as unknown as {
        state: { status: string }
      }
      await act(async () => {
        chat.state.status = 'streaming'
      })
      streamingRefs.forEach(ref => {
        ref.current = true
      })
      await act(async () => {
        chat.state.status = status
      })
      await waitFor(() =>
        expect(streamingRefs.map(ref => ref.current)).toEqual([false, false])
      )
    }
  )

  it.each([false, true])(
    'renders a skeleton before effects for guest=%s',
    isGuest => {
      const html = renderToString(<Chat id="initial" isGuest={isGuest} />)
      expect(html).toContain('Loading chat')
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it.each([false, true])(
    'hydrates unloaded history for guest=%s without a mismatch',
    async isGuest => {
      const host = document.createElement('div')
      const element = <Chat id="hydrate" isGuest={isGuest} />
      host.innerHTML = renderToString(element)
      const serverHtml = host.innerHTML
      document.body.appendChild(host)
      const onRecoverableError = vi.fn()
      let resolve!: (response: Response) => void
      vi.mocked(fetch).mockReturnValueOnce(
        new Promise(r => {
          resolve = r
        })
      )
      let root!: ReturnType<typeof hydrateRoot>
      try {
        await act(async () => {
          root = hydrateRoot(host, element, { onRecoverableError })
        })
        expect(host.innerHTML).toBe(serverHtml)
        expect(onRecoverableError).not.toHaveBeenCalled()
        expect(fetch).toHaveBeenCalledOnce()
        await act(async () => {
          resolve(reply('hydrated history'))
        })
        expect(host).toHaveTextContent('hydrated history')
      } finally {
        act(() => root.unmount())
        host.remove()
      }
    }
  )

  it('hides the home state while history loads and after a load error', async () => {
    let reject!: (error: Error) => void
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((_, r) => {
        reject = r
      })
    )
    render(<Chat id="existing" />)
    expect(
      screen.getByRole('status', { name: 'Loading chat' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'What would you like to know?' })
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('full-chat')).not.toHaveClass('justify-center')
    await act(async () => {
      reject(new Error('Failed to load chat'))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load chat')
    expect(
      screen.queryByRole('heading', { name: 'What would you like to know?' })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('New'))
    expect(
      screen.getByRole('heading', { name: 'What would you like to know?' })
    ).toBeInTheDocument()
  })

  it.each([{}, { id: 'query', query: 'hello' }])(
    'keeps the home state for a new chat %s',
    props => {
      render(<Chat {...props} />)
      expect(
        screen.getByRole('heading', { name: 'What would you like to know?' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('status', { name: 'Loading chat' })
      ).not.toBeInTheDocument()
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('fetches an owner history once and reuses it on reopening', async () => {
    const first = render(<Chat id="a" />)
    expect(await screen.findByText(/server/)).toBeInTheDocument()
    first.unmount()
    render(<Chat id="a" />)
    expect(screen.getByText(/server/)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('loads guest history under Strict Mode', async () => {
    render(
      <StrictMode>
        <Chat id="public" isGuest />
      </StrictMode>
    )
    expect(await screen.findByText(/server/)).toBeInTheDocument()
    expect(screen.getByText('Send')).toBeEnabled()
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('loads public guest history and fetches again on a new mount', async () => {
    let resolve!: (response: Response) => void
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise(r => {
        resolve = r
      })
    )
    const first = render(<Chat id="public" isGuest />)
    expect(
      screen.getByRole('status', { name: 'Loading chat' })
    ).toBeInTheDocument()
    expect(screen.getByText('Send')).toBeDisabled()
    expect(fetch).toHaveBeenCalledWith('/api/chats/public', {
      cache: 'no-store'
    })
    await act(async () => {
      resolve(reply('public history'))
    })
    expect(screen.getByText(/public history/)).toBeInTheDocument()
    expect(screen.getByText('Send')).toBeEnabled()
    expect(chatStore.get('public')).toBeUndefined()
    first.unmount()
    render(<Chat id="public" isGuest />)
    expect(await screen.findByText(/server/)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('sends the full fetched history for a guest follow-up', async () => {
    render(<Chat id="public" isGuest />)
    expect(await screen.findByText(/server/)).toBeInTheDocument()
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        'data: {"type":"start","messageId":"answer"}\n\ndata: {"type":"finish","finishReason":"stop"}\n\ndata: [DONE]\n\n',
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'x-vercel-ai-ui-message-stream': 'v1'
          }
        }
      )
    )
    fireEvent.click(screen.getByText('Send'))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const body = JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0]).toEqual(messages('server')[0])
    expect(body.isNewChat).toBe(false)
    await waitFor(() => expect(screen.getByText('Send')).toBeEnabled())
  })

  it('does not fetch history for a new query chat', () => {
    render(<Chat id="query-chat" query="hello" />)
    expect(screen.getByText('Send')).toBeEnabled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reopens the same live Chat without fetching within the verified window', () => {
    const first = render(<Chat id="a" savedMessages={messages('seed')} />)
    act(() => {
      chatStore.get('a')!.chat.messages = messages('latest')
    })
    const instance = chatStore.get('a')!.chat
    first.unmount()
    render(<Chat id="a" savedMessages={messages('old page')} />)
    expect(chatStore.get('a')!.chat).toBe(instance)
    expect(screen.getByText(/latest/)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows cached messages while revalidating an older entry', async () => {
    const first = render(<Chat id="a" savedMessages={messages('cached')} />)
    first.unmount()
    chatStore.get('a')!.verifiedAt -= 30_000
    let resolve!: (response: Response) => void
    vi.mocked(fetch).mockReturnValue(
      new Promise(r => {
        resolve = r
      })
    )
    render(<Chat id="a" savedMessages={messages('old page')} />)
    expect(screen.getByText(/cached/)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledOnce()
    await act(async () => {
      resolve(reply('fresh'))
    })
    expect(screen.getByText(/fresh/)).toBeInTheDocument()
  })

  it('blocks sending while unverified history loads', async () => {
    let resolve!: (response: Response) => void
    vi.mocked(fetch).mockReturnValue(
      new Promise(r => {
        resolve = r
      })
    )
    render(<Chat id="a" />)
    expect(screen.getByText('Send')).toBeDisabled()
    await act(async () => {
      resolve(reply('loaded'))
    })
    expect(screen.getByText('Send')).toBeEnabled()
  })

  it.each(['seeded', 'local'] as const)(
    'keeps %s messages sendable after a background refresh fails',
    async source => {
      const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
      chatStore.setUser('owner')
      const entry = chatStore.getOrCreate('a', {
        messages: source === 'seeded' ? messages('cached') : undefined
      })
      if (source === 'local') entry.chat.messages = messages('cached')
      if (entry.verifiedAt !== 0) entry.verifiedAt -= 30_000
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network unavailable'))

      render(<Chat id="a" savedMessages={messages('old page')} />)

      await waitFor(() => expect(logError).toHaveBeenCalledOnce())
      expect(screen.getByText(/cached/)).toBeInTheDocument()
      expect(screen.getByText('Send')).toBeEnabled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    }
  )

  it('shows a blocking error and retry when no history could be loaded', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to load chat'))
    render(<Chat id="a" />)
    expect(
      screen.getByRole('status', { name: 'Loading chat' })
    ).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load chat'
    )
    expect(screen.getByText('Send')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('Send')).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('creates an empty client entry on New and invalidates on stop', async () => {
    render(<Chat id="a" savedMessages={messages('seed')} />)
    fireEvent.click(screen.getByText('New'))
    await waitFor(() =>
      expect(screen.queryByText(/seed/)).not.toBeInTheDocument()
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(chatStore.get('a')!.chat.messages).toEqual(messages('seed'))
    fireEvent.click(screen.getByText('Stop'))
  })

  it('discards a background response while the cached Chat streams', async () => {
    const first = render(<Chat id="a" savedMessages={messages('cached')} />)
    first.unmount()
    chatStore.get('a')!.verifiedAt -= 30_000
    let resolve!: (response: Response) => void
    vi.mocked(fetch).mockReturnValue(
      new Promise(r => {
        resolve = r
      })
    )
    render(<Chat id="a" savedMessages={messages('old page')} />)
    await act(async () => {
      const chat = chatStore.get('a')!.chat as unknown as {
        state: { status: string }
      }
      chat.state.status = 'streaming'
      resolve(reply('obsolete'))
    })
    expect(chatStore.get('a')!.chat.messages).toEqual(messages('cached'))
  })

  it('retains the homepage entry after pushing the first-message URL', async () => {
    window.history.replaceState({}, '', '/')
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          'data: {"type":"start","messageId":"answer"}\n\ndata: {"type":"finish","finishReason":"stop"}\n\ndata: [DONE]\n\n',
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'x-vercel-ai-ui-message-stream': 'v1'
            }
          }
        )
      )
    )
    const view = render(<Chat />)
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'hello' }
    })
    fireEvent.click(screen.getByText('Submit'))
    const id = window.location.pathname.split('/').pop()!
    expect(window.location.pathname).toBe(`/search/${id}`)
    const entry = chatStore.get(id)!
    expect(entry).toBeDefined()
    await waitFor(() => expect(entry.hasServerHistory).toBe(true))
    view.rerender(<Chat id={id} savedMessages={[]} />)
    expect(chatStore.get(id)).toBe(entry)
    expect(entry.chat.messages[0].parts).toEqual([
      { type: 'text', text: 'hello' }
    ])
    expect(fetch).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByText('Stop'))
    expect(entry.verifiedAt).toBe(0)
    window.history.replaceState({}, '', '/')
  })

  it('does not retain guest messages when changing conversations', () => {
    const view = render(
      <Chat id="a" savedMessages={messages('first')} isGuest />
    )
    view.rerender(<Chat id="b" savedMessages={messages('second')} isGuest />)
    view.rerender(<Chat id="a" savedMessages={messages('reloaded')} isGuest />)
    expect(screen.getByText(/reloaded/)).toBeInTheDocument()
    expect(screen.queryByText(/first/)).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps guest state outside the shared store and skips history fetching', () => {
    render(
      <Chat id="guest" savedMessages={messages('guest history')} isGuest />
    )
    expect(screen.getByText(/guest history/)).toBeInTheDocument()
    expect(chatStore.get('guest')).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })
})
