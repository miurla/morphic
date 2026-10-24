'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { IconX as X } from '@tabler/icons-react'
import { toast } from 'sonner'

import { Chat as DBChat } from '@/lib/db/schema'
import {
  effectiveQueryLength,
  MIN_QUERY_LENGTH
} from '@/lib/utils/search-query'

import { Input } from '@/components/ui/input'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu
} from '@/components/ui/sidebar'

import { ChatHistorySearch } from './chat-history-search'
import { ChatHistorySkeleton } from './chat-history-skeleton'
import { ChatMenuItem } from './chat-menu-item'
import { ClearHistoryAction } from './clear-history-action'

interface ChatPageResponse {
  chats: DBChat[]
  nextOffset: number | null
}

// The API's minimum query length (shared constant), counted in code
// points: a shorter query keeps the chronological list visible instead of
// the results view.

export function ChatHistoryClient() {
  const [chats, setChats] = useState<DBChat[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Incremented per list refresh; lets fetchInitialChats detect when a
  // later request has superseded its in-flight response.
  const listRequestSeqRef = useRef(0)
  const [isPending, startTransition] = useTransition()
  // Based on the normalized query (what the search actually runs), counted
  // in code points: a paste whose bounded form falls below the minimum
  // keeps the chronological list, and a single non-BMP character (two code
  // units, one character) does not trigger a broad single-character search.
  const searchMode = effectiveQueryLength(query) >= MIN_QUERY_LENGTH
  const searchModeRef = useRef(searchMode)
  // A list refresh that started while search mode hid the list: the items
  // (possibly deleted chats) must not be revealed until a refresh
  // succeeds. Set at request start - the list is already stale the moment
  // the change lands, before the refetch settles - and cleared only by a
  // successful fetch.
  const [staleHiddenRefresh, setStaleHiddenRefresh] = useState(false)
  // Mirror for the event handler, which must read the flag without
  // re-subscribing on every change.
  const staleHiddenRefreshRef = useRef(false)
  // The exit-from-search retry also failed: show an actionable error
  // instead of an endless skeleton or the stale items.
  const [listRetryFailed, setListRetryFailed] = useState(false)
  // Bumped when chat data changes during search mode, telling the results
  // view to refetch so stale matches (e.g. after Clear History) cannot be
  // opened.
  const [searchEpoch, setSearchEpoch] = useState(0)
  // cmdk's active option; only used as a change signal for the ARIA mirror.
  const [activeResult, setActiveResult] = useState<string | undefined>()

  // Mirror cmdk's listbox state onto the search input for assistive tech:
  // the input sits outside the Command scope and cmdk generates the list and
  // option ids internally, so the combobox relationships (aria-controls,
  // aria-activedescendant) are resolved from the rendered cmdk DOM.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const list = searchMode
      ? resultsRef.current?.querySelector<HTMLElement>('[cmdk-list]')
      : undefined
    if (!list) {
      input.removeAttribute('aria-controls')
      input.removeAttribute('aria-activedescendant')
      return
    }
    input.setAttribute('aria-controls', list.id)
    const active = list.querySelector<HTMLElement>(
      '[cmdk-item][data-selected="true"]'
    )
    if (active?.id) {
      input.setAttribute('aria-activedescendant', active.id)
    } else {
      input.removeAttribute('aria-activedescendant')
    }
  }, [activeResult, searchMode])

  useEffect(() => {
    searchModeRef.current = searchMode
  }, [searchMode])

  useEffect(() => {
    staleHiddenRefreshRef.current = staleHiddenRefresh
  }, [staleHiddenRefresh])

  const fetchInitialChats = useCallback(async (): Promise<
    'ok' | 'failed' | 'superseded'
  > => {
    // Generation guard (same pattern as the results view): overlapping
    // refreshes must not interleave. A superseded response may predate the
    // data change that started the newer request, so only the latest
    // request may apply its data or move the suppression flags.
    const seq = ++listRequestSeqRef.current
    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats?offset=0&limit=20`)
      if (!response.ok) {
        throw new Error('Failed to fetch initial chat history')
      }
      const { chats: dbChats, nextOffset: newNextOffset } =
        (await response.json()) as ChatPageResponse

      if (seq !== listRequestSeqRef.current) return 'superseded'
      setChats(dbChats)
      setNextOffset(newNextOffset)
      return 'ok'
    } catch (error) {
      if (seq !== listRequestSeqRef.current) return 'superseded'
      console.error('Failed to load initial chats:', error)
      toast.error('Failed to load chat history.')
      setNextOffset(null)
      return 'failed'
    } finally {
      if (seq === listRequestSeqRef.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInitialChats()
  }, [fetchInitialChats])

  useEffect(() => {
    const handleHistoryUpdate = () => {
      // Capture the mode at request start: the user may leave search mode
      // before the request settles, and a refresh that began while the list
      // was hidden must be treated as hidden regardless of the mode at
      // completion.
      const startedHidden = searchModeRef.current
      if (startedHidden) {
        setSearchEpoch(epoch => epoch + 1)
        // Suppress from the start: the list is stale the moment the data
        // changed, not only once the refetch proves it by failing.
        setStaleHiddenRefresh(true)
        setListRetryFailed(false)
      }
      startTransition(async () => {
        const result = await fetchInitialChats()
        // A superseded request has no say: the newer request owns the
        // suppression state, so an older success must not clear the marker
        // a newer failure may still set (and an older failure must not
        // mark a retry that a newer success has already resolved).
        if (result === 'ok') {
          setStaleHiddenRefresh(false)
          setListRetryFailed(false)
        } else if (
          result === 'failed' &&
          (startedHidden || staleHiddenRefreshRef.current)
        ) {
          // Any latest failure while the stale suppression is active is a
          // retry failure: a visible-mode refresh that superseded the
          // hidden one must surface the error, or the suppressed branch
          // would render an endless skeleton with no Retry action.
          setListRetryFailed(true)
        }
      })
    }
    window.addEventListener('chat-history-updated', handleHistoryUpdate)
    return () => {
      window.removeEventListener('chat-history-updated', handleHistoryUpdate)
    }
  }, [fetchInitialChats, startTransition])

  // Retry a refresh that failed while the list was hidden. The stale items
  // (possibly deleted chats) stay suppressed until a refresh succeeds:
  // skeleton while a retry is in flight, an actionable error once one
  // fails. The marker clears only on success.
  const retryStaleList = useCallback(() => {
    setListRetryFailed(false)
    startTransition(async () => {
      const result = await fetchInitialChats()
      if (result === 'ok') {
        setStaleHiddenRefresh(false)
      } else if (result === 'failed') {
        setListRetryFailed(true)
      }
    })
  }, [fetchInitialChats, startTransition])

  useEffect(() => {
    if (!searchMode && staleHiddenRefresh) {
      retryStaleList()
    }
  }, [searchMode, staleHiddenRefresh, retryStaleList])

  const fetchMoreChats = useCallback(async () => {
    if (isLoading || nextOffset === null) return

    // Same generation guard as fetchInitialChats: a page fetched before a
    // data change (e.g. Clear History) must not append its pre-deletion
    // chats after the refresh that superseded this request replaced the
    // list.
    const seq = ++listRequestSeqRef.current
    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats?offset=${nextOffset}&limit=20`)
      if (!response.ok) {
        throw new Error('Failed to fetch more chat history')
      }
      const { chats: dbChats, nextOffset: newNextOffset } =
        (await response.json()) as ChatPageResponse

      if (seq !== listRequestSeqRef.current) return
      setChats(prevChats => [...prevChats, ...dbChats])
      setNextOffset(newNextOffset)
    } catch (error) {
      if (seq !== listRequestSeqRef.current) return
      console.error('Failed to load more chats:', error)
      toast.error('Failed to load more chat history.')
      setNextOffset(null)
    } finally {
      if (seq === listRequestSeqRef.current) setIsLoading(false)
    }
  }, [nextOffset, isLoading])

  useEffect(() => {
    const observerRefValue = loadMoreRef.current
    if (!observerRefValue || nextOffset === null || isPending) return
    // Pause infinite scroll while the results view replaces the list.
    if (searchMode) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoading && !isPending) {
          fetchMoreChats()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(observerRefValue)

    return () => {
      if (observerRefValue) {
        observer.unobserve(observerRefValue)
      }
    }
  }, [fetchMoreChats, nextOffset, isLoading, isPending, searchMode])

  const isHistoryEmpty = !isLoading && !chats.length && nextOffset === null

  return (
    <div className="flex flex-col flex-1 h-full">
      <SidebarGroup>
        <div className="flex items-center justify-between w-full">
          <SidebarGroupLabel className="p-0">History</SidebarGroupLabel>
          <ClearHistoryAction empty={isHistoryEmpty} />
        </div>
        <div className="relative mt-1.5">
          <Input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            role="combobox"
            aria-expanded={searchMode}
            aria-autocomplete="list"
            onKeyDown={event => {
              // While an IME composition is active, Enter confirms a
              // candidate and Escape cancels it; those keystrokes belong to
              // the IME, not to the search field or the result list. Some
              // browser/IME combinations signal composition via keyCode 229
              // without setting isComposing (same guard cmdk applies).
              if (event.nativeEvent.isComposing || event.keyCode === 229) return
              if (event.key === 'Escape') {
                setQuery('')
                return
              }
              if (!searchMode) return
              // The input lives outside the Command scope, so cmdk never sees
              // these keys. Re-dispatch them on the cmdk root so its own
              // navigation (ArrowUp/ArrowDown) and activation (Enter) apply.
              if (
                event.key === 'ArrowDown' ||
                event.key === 'ArrowUp' ||
                event.key === 'Enter'
              ) {
                const commandRoot =
                  resultsRef.current?.querySelector<HTMLElement>('[cmdk-root]')
                if (!commandRoot) return
                event.preventDefault()
                commandRoot.dispatchEvent(
                  new KeyboardEvent('keydown', {
                    key: event.key,
                    bubbles: true,
                    cancelable: true
                  })
                )
              }
            }}
            placeholder="Search history"
            aria-label="Search history"
            className="h-8 text-xs pr-7"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </SidebarGroup>
      <div ref={resultsRef} className="flex-1 overflow-y-auto mb-2 relative">
        {searchMode ? (
          <ChatHistorySearch
            refreshKey={searchEpoch}
            query={query}
            onActiveValueChange={setActiveResult}
          />
        ) : staleHiddenRefresh ? (
          listRetryFailed ? (
            <div className="px-2 py-4 text-center">
              <p className="text-muted-foreground text-sm">
                Failed to load chat history.
              </p>
              <button
                type="button"
                onClick={retryStaleList}
                className="text-muted-foreground hover:text-foreground hover:bg-accent mt-1 rounded-sm px-2 py-1 text-xs transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="py-2">
              <ChatHistorySkeleton />
            </div>
          )
        ) : isHistoryEmpty && !isPending ? (
          <div className="px-2 text-foreground/30 text-sm text-center py-4">
            No chats yet
          </div>
        ) : (
          <SidebarMenu>
            {chats.map(
              (chat: DBChat) =>
                chat && <ChatMenuItem key={chat.id} chat={chat} />
            )}
          </SidebarMenu>
        )}
        {!searchMode && <div ref={loadMoreRef} style={{ height: '1px' }} />}
        {!searchMode && !staleHiddenRefresh && (isLoading || isPending) && (
          <div className="py-2">
            <ChatHistorySkeleton />
          </div>
        )}
      </div>
    </div>
  )
}
