import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import { ChatStore } from './index'

vi.mock('@/lib/analytics/posthog-client', () => ({
  getDistinctId: () => 'visitor'
}))

const messages = (text: string): UIMessage[] => [
  { id: text, role: 'user', parts: [{ type: 'text', text }] }
]
const response = (text: string) =>
  new Response(JSON.stringify({ messages: messages(text) }))
const deferred = () => {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>(r => {
    resolve = r
  })
  return { promise, resolve }
}

// Exercise SDK status transitions without issuing a generation request.
function setStatus(
  entry: ReturnType<ChatStore['getOrCreate']>,
  status: 'submitted' | 'streaming' | 'ready'
) {
  ;(entry.chat as unknown as { state: { status: string } }).state.status =
    status
}

describe('ChatStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01'))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(response('server')))
    )
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('seeds once and reuses the live Chat within the verified window', async () => {
    const store = new ChatStore()
    const entry = store.getOrCreate('a', { messages: messages('seed') })
    entry.chat.messages = messages('local')
    expect(store.getOrCreate('a', { messages: messages('stale page') })).toBe(
      entry
    )
    await store.revalidate('a')
    expect(fetch).not.toHaveBeenCalled()
    expect(entry.chat.messages).toEqual(messages('local'))
    vi.advanceTimersByTime(30_000)
    const request = store.revalidate('a')
    expect(entry.chat.messages).toEqual(messages('local'))
    await request
    expect(entry.chat.messages).toEqual(messages('server'))
  })

  it('fetches missing history and deduplicates concurrent fetches', async () => {
    const pending = deferred()
    vi.mocked(fetch).mockReturnValue(pending.promise)
    const store = new ChatStore()
    const entry = store.getOrCreate('a')
    const first = store.revalidate('a')
    expect(entry.verifiedAt).toBe(0)
    expect(entry.fetching).toBe(first)
    expect(store.revalidate('a')).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(1)
    pending.resolve(response('loaded'))
    await first
    expect(entry.hasServerHistory).toBe(true)
    expect(entry.fetching).toBeUndefined()
  })

  it('refreshes signed URLs despite a recent verification', async () => {
    const store = new ChatStore()
    const entry = store.getOrCreate('a', { messages: messages('old url') })
    vi.advanceTimersByTime(30 * 60_000)
    store.markVerified('a')
    await store.revalidate('a')
    expect(fetch).toHaveBeenCalledOnce()
    expect(entry.chat.messages).toEqual(messages('server'))
    expect(entry.loadedAt).toBe(Date.now())
  })

  it.each(['submitted', 'streaming'] as const)(
    'discards background results while %s',
    async status => {
      const pending = deferred()
      vi.mocked(fetch).mockReturnValue(pending.promise)
      const store = new ChatStore()
      const entry = store.getOrCreate('a', { messages: messages('cached') })
      store.invalidate('a')
      const request = store.revalidate('a')
      setStatus(entry, status)
      pending.resolve(response('stale'))
      await request
      expect(entry.chat.messages).toEqual(messages('cached'))
      expect(entry.verifiedAt).toBe(0)
    }
  )

  it('discards results after a local turn finishes or is invalidated', async () => {
    const pending = deferred()
    vi.mocked(fetch).mockReturnValue(pending.promise)
    const store = new ChatStore()
    const entry = store.getOrCreate('a')
    const request = store.revalidate('a')
    entry.chat.messages = messages('finished')
    store.markVerified('a')
    pending.resolve(response('stale'))
    await request
    expect(entry.chat.messages).toEqual(messages('finished'))
  })

  it('evicts least recently used entries', () => {
    const store = new ChatStore(2)
    store.getOrCreate('a')
    store.getOrCreate('b')
    store.getOrCreate('a')
    store.getOrCreate('c')
    expect(store.get('a')).toBeDefined()
    expect(store.get('b')).toBeUndefined()
  })

  it('enforces the total size cap, including message edits', () => {
    const size = JSON.stringify(messages('a')).length
    const store = new ChatStore(20, size * 2)
    store.getOrCreate('a', { messages: messages('a') })
    const b = store.getOrCreate('b', { messages: messages('b') })
    b.chat.messages = messages('longer')
    expect(store.get('a')).toBeUndefined()
    expect(store.get('b')).toBe(b)
  })

  it.each([
    [1, Infinity, 'submitted'],
    [1, Infinity, 'streaming'],
    [20, 2, 'submitted'],
    [20, 2, 'streaming']
  ] as const)(
    'keeps a newly opened entry with limits %s/%s while another is %s',
    async (maxEntries, maxSize, status) => {
      const store = new ChatStore(maxEntries, maxSize)
      const a = store.getOrCreate('a')
      setStatus(a, status)
      const b = store.getOrCreate('b')
      expect(store.get('a')).toBe(a)
      expect(store.get('b')).toBe(b)
      await store.revalidate('b')
      expect(b.chat.messages).toEqual(messages('server'))
      expect(b.verifiedAt).toBe(Date.now())
      expect(store.get('b')).toBe(b)

      setStatus(a, 'ready')
      expect(store.get('a')).toBe(a)
      expect(store.get('b')).toBeUndefined()
    }
  )

  it('keeps a touched entry even when it alone exceeds the size cap', () => {
    const store = new ChatStore(20, 2)
    const entry = store.getOrCreate('a')
    entry.chat.messages = messages('large')
    expect(store.get('a')).toBe(entry)
    expect(store.getOrCreate('a')).toBe(entry)
  })

  it.each([undefined, [] as UIMessage[]])(
    'skips revalidation for an untouched local chat initialized with %s',
    async initialMessages => {
      const store = new ChatStore()
      const entry = store.getOrCreate('a', {
        isNew: true,
        messages: initialMessages
      })
      vi.advanceTimersByTime(30_000)
      expect(store.getOrCreate('a')).toBe(entry)
      await store.revalidate('a')
      store.invalidate('a')
      await store.revalidate('a')
      expect(fetch).not.toHaveBeenCalled()
      expect(entry.chat.messages).toEqual([])
      expect(entry.error).toBeUndefined()
    }
  )

  it('refreshes an aborted first local turn and adopts server messages', async () => {
    const events = [
      { type: 'start', messageId: 'answer' },
      { type: 'text-start', id: 'text' },
      { type: 'text-delta', id: 'text', delta: 'partial answer' }
    ]
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          pull(controller) {
            const event = events.shift()
            if (event) {
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
              )
            } else {
              controller.error(new DOMException('Aborted', 'AbortError'))
            }
          }
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'x-vercel-ai-ui-message-stream': 'v1'
          }
        }
      )
    )
    const store = new ChatStore()
    const entry = store.getOrCreate('a', { isNew: true })
    const onFinish = vi.fn()
    store.attachHandlers(entry, { onFinish })

    await entry.chat.sendMessage({ text: 'first' })

    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({ isAbort: true })
    )
    expect(entry.chat.messages).toHaveLength(2)
    expect(entry.chat.messages[1].parts).toContainEqual(
      expect.objectContaining({ type: 'text', text: 'partial answer' })
    )
    expect(entry.hasServerHistory).toBe(false)
    expect(entry.verifiedAt).toBe(0)
    vi.advanceTimersByTime(30_000)

    await store.revalidate('a')

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(entry.chat.messages).toEqual(messages('server'))
    expect(entry.hasServerHistory).toBe(true)
    expect(entry.verifiedAt).toBe(Date.now())
  })

  it('keeps an unsaved first local message sendable after a 404', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
    const store = new ChatStore()
    const entry = store.getOrCreate('a', { isNew: true })
    await entry.chat.sendMessage({ text: 'first' })
    const localMessages = entry.chat.messages
    vi.advanceTimersByTime(30_000)

    await store.revalidate('a')

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(entry.chat.messages).toBe(localMessages)
    expect(entry.chat.messages).toHaveLength(1)
    expect(entry.error).toBeUndefined()
    expect(entry.hasServerHistory).toBe(false)
    expect(entry.fetching).toBeUndefined()
    expect(entry.verifiedAt).toBe(0)
  })

  it('clears on user changes and prevents old fetches from restoring data', async () => {
    const pending = deferred()
    vi.mocked(fetch).mockReturnValue(pending.promise)
    const store = new ChatStore()
    store.setUser('first')
    store.getOrCreate('a')
    const request = store.revalidate('a')
    store.setUser('first')
    expect(store.get('a')).toBeDefined()
    store.setUser('second')
    expect(store.get('a')).toBeUndefined()
    pending.resolve(response('old account'))
    await request
    expect(store.get('a')).toBeUndefined()
    store.getOrCreate('b')
    store.setUser(null)
    expect(store.get('b')).toBeUndefined()
  })

  it.each(['seeded', 'local', 'empty server history'] as const)(
    'keeps %s usable after background revalidation fails and retries on reopen',
    async source => {
      const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const failure = new Error('Network unavailable')
      vi.mocked(fetch).mockRejectedValueOnce(failure)
      const store = new ChatStore()
      const entry = store.getOrCreate('a', {
        messages:
          source === 'seeded'
            ? messages('cached')
            : source === 'empty server history'
              ? []
              : undefined
      })
      if (source === 'local') entry.chat.messages = messages('local')
      const originalMessages = entry.chat.messages
      const verifiedAt = entry.verifiedAt
      vi.advanceTimersByTime(30_000)

      await store.revalidate('a')

      expect(entry.verifiedAt).toBe(verifiedAt)
      expect(entry.error).toBeUndefined()
      expect(entry.fetching).toBeUndefined()
      expect(entry.chat.messages).toBe(originalMessages)
      expect(logError).toHaveBeenCalledWith(
        'Failed to revalidate chat:',
        failure
      )

      store.getOrCreate('a')
      await store.revalidate('a')
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(entry.chat.messages).toEqual(messages('server'))
    }
  )

  it('blocks an empty entry after a load failure and allows retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 404 }))
    const store = new ChatStore()
    const entry = store.getOrCreate('a')
    await store.revalidate('a')
    expect(entry.chat.messages).toEqual([])
    expect(entry.fetching).toBeUndefined()
    expect(entry.error?.message).toBe('Chat not found')
    expect(entry.verifiedAt).toBe(0)
    await store.revalidate('a')
    expect(entry.error).toBeUndefined()
    expect(entry.verifiedAt).toBe(Date.now())
  })

  it.each(['seeded', 'local', 'empty server history', 'saved local'] as const)(
    'clears %s and blocks the entry after a 404',
    async source => {
      const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(null, { status: 404 })
      )
      const store = new ChatStore()
      const entry = store.getOrCreate('a', {
        isNew: source === 'saved local',
        messages:
          source === 'seeded'
            ? messages('cached')
            : source === 'empty server history'
              ? []
              : undefined
      })
      if (source === 'local') entry.chat.messages = messages('local')
      if (source === 'saved local') {
        entry.chat.messages = messages('saved')
        store.markVerified('a')
      }
      vi.advanceTimersByTime(30_000)

      await store.revalidate('a')

      expect(entry.chat.messages).toEqual([])
      expect(entry.error?.message).toBe('Chat not found')
      expect(entry.verifiedAt).toBe(0)
      expect(entry.fetching).toBeUndefined()
      expect(logError).not.toHaveBeenCalled()
    }
  )

  it.each([false, true])(
    'sends the expected history for guest=%s and verifies on finish',
    async isGuest => {
      vi.useRealTimers()
      const events = [
        { type: 'start', messageId: 'answer' },
        { type: 'text-start', id: 'text' },
        { type: 'text-delta', id: 'text', delta: 'answer' },
        { type: 'text-end', id: 'text' },
        { type: 'finish', finishReason: 'stop' }
      ]
      const streamResponse = () =>
        new Response(
          events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') +
            'data: [DONE]\n\n',
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'x-vercel-ai-ui-message-stream': 'v1'
            }
          }
        )
      vi.mocked(fetch).mockImplementation(() =>
        Promise.resolve(streamResponse())
      )
      const store = new ChatStore()
      const entry = store.getOrCreate('new', { isNew: true, isGuest })
      const oldHandler = vi.fn()
      const currentHandler = vi.fn()
      const detachOld = store.attachHandlers(entry, { onFinish: oldHandler })
      store.attachHandlers(entry, { onFinish: currentHandler })
      detachOld()
      await entry.chat.sendMessage({ text: 'first' })
      const firstBody = JSON.parse(
        vi.mocked(fetch).mock.calls[0][1]!.body as string
      )
      expect(firstBody.isNewChat).toBe(true)
      expect(firstBody.messages).toEqual(
        isGuest ? expect.any(Array) : undefined
      )
      expect(entry.hasServerHistory).toBe(true)
      expect(entry.verifiedAt).toBeGreaterThan(0)
      expect(currentHandler).toHaveBeenCalledOnce()
      expect(oldHandler).not.toHaveBeenCalled()
      await entry.chat.sendMessage({ text: 'second' })
      const secondBody = JSON.parse(
        vi.mocked(fetch).mock.calls[1][1]!.body as string
      )
      expect(secondBody.isNewChat).toBe(false)
      if (isGuest) expect(secondBody.messages).toHaveLength(3)
    }
  )

  it('removes and clears entries and notifies subscribers', () => {
    const store = new ChatStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.getOrCreate('a')
    store.remove('a')
    expect(store.get('a')).toBeUndefined()
    store.getOrCreate('b')
    store.clear()
    expect(store.get('b')).toBeUndefined()
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })
})
