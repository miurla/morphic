'use client'

import { useMemo, useSyncExternalStore } from 'react'

import { type DraftBlock, parseDraftBlocks } from '@/lib/draft/draft'
import type { UIMessage } from '@/lib/types/ai'

// The draft panel lives in the layout-level inspector, outside the chat that
// owns the messages, so each chat registers what the panel needs here. The
// layout mounts a desktop and a mobile chat; the panel reads the visible one,
// chosen when the store is read rather than by which chat wrote last.
type DraftSource = {
  messages: UIMessage[]
  isStreaming: boolean
  quote: ((text: string) => void) | null
}

type Registration = DraftSource & { isVisible: () => boolean }

const EMPTY: DraftSource = { messages: [], isStreaming: false, quote: null }

const sources = new Map<string, Registration>()
const listeners = new Set<() => void>()
let snapshot: DraftSource = EMPTY

function pick(): DraftSource {
  for (const source of sources.values()) {
    if (source.isVisible()) return source
  }
  return EMPTY
}

function emit() {
  const next = pick()
  if (next === snapshot) return
  snapshot = next
  for (const listener of listeners) listener()
}

export function registerDraftSource(id: string, source: Registration) {
  sources.set(id, source)
  emit()
}

export function unregisterDraftSource(id: string) {
  if (!sources.delete(id)) return
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // A resize can swap which chat is visible without either one writing.
  if (listeners.size === 1) window.addEventListener('resize', emit)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('resize', emit)
  }
}

export function useDraftStore(): DraftSource {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY
  )
}

/** The draft block still being written in the latest answer, if any. */
export function useLiveDraftBlock(): DraftBlock | null {
  const { messages, isStreaming } = useDraftStore()
  return useMemo(() => {
    const last = messages.at(-1)
    if (!isStreaming || last?.role !== 'assistant') return null
    for (const part of [...(last.parts ?? [])].reverse()) {
      if (part.type !== 'text') continue
      const block = parseDraftBlocks(part.text).at(-1)
      if (block && !block.closed) return block
    }
    return null
  }, [messages, isStreaming])
}
