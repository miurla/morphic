'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { IconX as X } from '@tabler/icons-react'
import { toast } from 'sonner'

import { Chat as DBChat } from '@/lib/db/schema'
import {
  MIN_QUERY_LENGTH,
  normalizeSearchQuery
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

// The API's minimum query length (shared constant): a shorter query keeps
// the chronological list visible instead of the results view.

export function ChatHistoryClient() {
  const [chats, setChats] = useState<DBChat[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  // Based on the normalized query (what the search actually runs): a paste
  // whose bounded form falls below the minimum keeps the chronological
  // list instead of mounting a search view that can never produce results.
  const searchMode = normalizeSearchQuery(query).length >= MIN_QUERY_LENGTH
  const searchModeRef = useRef(searchMode)
  const [staleHiddenRefresh, setStaleHiddenRefresh] = useState(false)
  const [isRetryingList, setIsRetryingList] = useState(false)
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

  const fetchInitialChats = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats?offset=0&limit=20`)
      if (!response.ok) {
        throw new Error('Failed to fetch initial chat history')
      }
      const { chats: dbChats, nextOffset: newNextOffset } =
        (await response.json()) as ChatPageResponse

      setChats(dbChats)
      setNextOffset(newNextOffset)
      return true
    } catch (error) {
      console.error('Failed to load initial chats:', error)
      toast.error('Failed to load chat history.')
      setNextOffset(null)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInitialChats()
  }, [fetchInitialChats])

  useEffect(() => {
    const handleHistoryUpdate = () => {
      // Chat data changed (e.g. Clear History). Refresh the chronological
      // list even while search mode hides it: deferring the refresh would
      // reveal stale items when the user leaves search mode (deleted chats
      // stay clickable for the whole deferred request). The hidden list
      // renders nothing, so refreshing it cannot disturb the results view,
      // which refetches via the epoch bump below.
      if (searchModeRef.current) {
        setSearchEpoch(epoch => epoch + 1)
      }
      startTransition(async () => {
        const ok = await fetchInitialChats()
        // A refresh that failed while the list was hidden must not leave
        // deleted chats to be revealed later: mark the list stale and
        // retry when search mode ends. The marker clears only on success.
        if (ok) {
          setStaleHiddenRefresh(false)
        } else if (searchModeRef.current) {
          setStaleHiddenRefresh(true)
        }
      })
    }
    window.addEventListener('chat-history-updated', handleHistoryUpdate)
    return () => {
      window.removeEventListener('chat-history-updated', handleHistoryUpdate)
    }
  }, [fetchInitialChats, startTransition])

  // Retry a refresh that failed while the list was hidden. Stale items
  // (possibly deleted chats) stay suppressed while the retry is in flight;
  // a failed retry keeps the marker so the next exit from search mode
  // tries again.
  useEffect(() => {
    if (!searchMode && staleHiddenRefresh) {
      setIsRetryingList(true)
      startTransition(async () => {
        const ok = await fetchInitialChats()
        setIsRetryingList(false)
        if (ok) {
          setStaleHiddenRefresh(false)
        }
      })
    }
  }, [searchMode, staleHiddenRefresh, fetchInitialChats, startTransition])

  const fetchMoreChats = useCallback(async () => {
    if (isLoading || nextOffset === null) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats?offset=${nextOffset}&limit=20`)
      if (!response.ok) {
        throw new Error('Failed to fetch more chat history')
      }
      const { chats: dbChats, nextOffset: newNextOffset } =
        (await response.json()) as ChatPageResponse

      setChats(prevChats => [...prevChats, ...dbChats])
      setNextOffset(newNextOffset)
    } catch (error) {
      console.error('Failed to load more chats:', error)
      toast.error('Failed to load more chat history.')
      setNextOffset(null)
    } finally {
      setIsLoading(false)
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
        ) : isRetryingList ? (
          <div className="py-2">
            <ChatHistorySkeleton />
          </div>
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
        {!searchMode && !isRetryingList && (isLoading || isPending) && (
          <div className="py-2">
            <ChatHistorySkeleton />
          </div>
        )}
      </div>
    </div>
  )
}
