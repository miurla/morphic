'use client'

import { Chat } from '@ai-sdk/react'
import { ChatInit, DefaultChatTransport } from 'ai'

import { getDistinctId } from '@/lib/analytics/posthog-client'
import { generateId } from '@/lib/db/schema'
import type { UIMessage } from '@/lib/types/ai'

export type ChatHandlers = Pick<ChatInit<UIMessage>, 'onFinish' | 'onError'>
export type ChatEntry = {
  chat: Chat<UIMessage>
  handlers: { current: ChatHandlers }
  verifiedAt: number
  loadedAt: number
  hasServerHistory: boolean
  fetching?: Promise<void>
  error?: Error
  revision: number
  size: number
  dispose: () => void
}

const busy = (entry: ChatEntry) =>
  entry.chat.status === 'submitted' || entry.chat.status === 'streaming'

export class ChatStore {
  private entries = new Map<string, ChatEntry>()
  private userId: string | null = null
  private listeners = new Set<() => void>()
  private version = 0

  constructor(
    private maxEntries = 20,
    private maxSize = 20 * 1024 * 1024
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.version
  private emit() {
    this.version++
    this.listeners.forEach(listener => listener())
  }

  setUser(userId: string | null) {
    if (this.userId !== userId) {
      this.userId = userId
      this.clear()
    }
  }

  attachHandlers(entry: ChatEntry, handlers: ChatHandlers) {
    entry.handlers.current = handlers
    return () => {
      if (entry.handlers.current === handlers) entry.handlers.current = {}
    }
  }

  get(id: string) {
    return this.entries.get(id)
  }

  getOrCreate(
    id: string,
    options: { messages?: UIMessage[]; isNew?: boolean; isGuest?: boolean } = {}
  ) {
    const existing = this.entries.get(id)
    if (existing) {
      this.entries.delete(id)
      this.entries.set(id, existing)
      return existing
    }
    const now = Date.now()
    const handlers: ChatEntry['handlers'] = { current: {} }
    const entry: ChatEntry = {
      chat: new Chat<UIMessage>({
        id,
        messages: options.messages,
        generateId,
        transport: new DefaultChatTransport({
          api: '/api/chat',
          prepareSendMessagesRequest: ({
            messages,
            trigger,
            messageId,
            body
          }) => {
            const lastMessage = messages[messages.length - 1]
            const original =
              trigger === 'regenerate-message'
                ? messages.find(m => m.id === messageId)
                : undefined
            return {
              body: {
                ...body,
                trigger,
                chatId: id,
                messageId,
                clientSource: 'web',
                analyticsId: getDistinctId(),
                ...(options.isGuest ? { messages } : {}),
                message:
                  trigger === 'regenerate-message' && original?.role === 'user'
                    ? original
                    : trigger === 'submit-message'
                      ? lastMessage
                      : undefined,
                isNewChat:
                  trigger === 'submit-message' &&
                  messages.length === 1 &&
                  !entry.hasServerHistory
              }
            }
          }
        }),
        onFinish: event => {
          if (this.entries.get(id) === entry) {
            if (event.isAbort || event.isError) this.invalidate(id)
            else this.markVerified(id)
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('chat-history-updated'))
          }
          return handlers.current.onFinish?.(event)
        },
        onError: error => {
          if (this.entries.get(id) === entry) this.invalidate(id)
          handlers.current.onError?.(error)
        }
      }),
      handlers,
      verifiedAt: options.messages !== undefined || options.isNew ? now : 0,
      loadedAt: now,
      hasServerHistory: options.messages !== undefined && !options.isNew,
      revision: 0,
      size: 0,
      dispose: () => {}
    }
    const updateSize = () => {
      if (!busy(entry)) {
        entry.size = JSON.stringify(entry.chat.messages).length
        this.prune()
      }
    }
    const unsubscribes = [
      entry.chat['~registerMessagesCallback'](updateSize),
      entry.chat['~registerStatusCallback'](() => {
        entry.revision++
        updateSize()
      })
    ]
    entry.dispose = () => unsubscribes.forEach(unsubscribe => unsubscribe())
    entry.size = JSON.stringify(entry.chat.messages).length
    this.entries.set(id, entry)
    this.prune()
    return entry
  }

  private prune() {
    let size = [...this.entries.values()].reduce((sum, e) => sum + e.size, 0)
    for (const [id, entry] of this.entries) {
      if (this.entries.size <= this.maxEntries && size <= this.maxSize) break
      if (busy(entry)) continue
      size -= entry.size
      entry.dispose()
      this.entries.delete(id)
    }
  }

  markVerified(id: string) {
    const entry = this.entries.get(id)
    if (!entry) return
    entry.verifiedAt = Date.now()
    entry.hasServerHistory = true
    entry.revision++
    this.emit()
  }
  invalidate(id: string) {
    const entry = this.entries.get(id)
    if (!entry) return
    entry.verifiedAt = 0
    entry.revision++
    this.emit()
  }
  remove(id: string) {
    const entry = this.entries.get(id)
    if (entry) entry.handlers.current = {}
    entry?.dispose()
    this.entries.delete(id)
    void entry?.chat.stop()
    this.emit()
  }
  clear() {
    const entries = [...this.entries.values()]
    this.entries.clear()
    entries.forEach(entry => {
      entry.handlers.current = {}
      entry.dispose()
      void entry.chat.stop()
    })
    this.emit()
  }

  revalidate(id: string): Promise<void> {
    const entry = this.entries.get(id)
    if (!entry) return Promise.resolve()
    if (entry.fetching) return entry.fetching
    const now = Date.now()
    if (
      entry.verifiedAt !== 0 &&
      now - entry.verifiedAt < 30_000 &&
      now - entry.loadedAt < 30 * 60_000
    )
      return Promise.resolve()
    const revision = entry.revision
    entry.error = undefined
    entry.fetching = (async () => {
      try {
        const response = await fetch(`/api/chats/${encodeURIComponent(id)}`, {
          cache: 'no-store'
        })
        if (!response.ok)
          throw new Error(
            response.status === 404 ? 'Chat not found' : 'Failed to load chat'
          )
        const data = (await response.json()) as { messages: UIMessage[] }
        // A local turn or account change makes this response obsolete.
        if (
          this.entries.get(id) !== entry ||
          busy(entry) ||
          entry.revision !== revision
        )
          return
        entry.chat.messages = data.messages
        entry.loadedAt = Date.now()
        this.markVerified(id)
      } catch (error) {
        if (this.entries.get(id) === entry && entry.revision === revision) {
          if (entry.hasServerHistory || entry.chat.messages.length > 0) {
            console.error('Failed to revalidate chat:', error)
          } else {
            entry.verifiedAt = 0
            entry.error =
              error instanceof Error ? error : new Error('Failed to load chat')
          }
        }
      } finally {
        entry.fetching = undefined
        this.emit()
      }
    })()
    this.emit()
    return entry.fetching
  }
}

export const chatStore = new ChatStore()
