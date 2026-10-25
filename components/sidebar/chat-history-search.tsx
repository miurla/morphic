'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  IconLoader2 as Loader2,
  IconSparkles as Sparkles
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { HL_START, HL_STOP } from '@/lib/render/highlight-markers'
import {
  effectiveQueryLength,
  MIN_QUERY_LENGTH,
  normalizeSearchQuery
} from '@/lib/utils/search-query'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList
} from '@/components/ui/command'

import { ChatHistorySkeleton } from './chat-history-skeleton'

const DEBOUNCE_MS = 250

export interface SearchResultItem {
  chatId: string
  title: string
  snippet?: string
  highlight?: string
}

interface SearchResponse {
  title: SearchResultItem[]
  content: SearchResultItem[]
  thinking?: SearchResultItem[]
}

// Renders a ts_headline snippet, emphasizing the terms delimited by
// HL_START/HL_STOP control characters. The delimiters are parsed into
// elements (never injected as HTML), so literal HTML in message text stays
// plain text.
function HighlightedSnippet({ highlight }: { highlight: string }) {
  const segments = highlight.split(
    new RegExp(`(${HL_START}[\\s\\S]*?${HL_STOP})`, 'g')
  )
  return (
    <p className="text-muted-foreground text-xs leading-snug break-words line-clamp-2 w-full">
      {segments.map((segment, index) =>
        segment.startsWith(HL_START) && segment.endsWith(HL_STOP) ? (
          <b key={index} className="font-semibold text-foreground">
            {segment.slice(HL_START.length, -HL_STOP.length)}
          </b>
        ) : (
          <span key={index}>{segment}</span>
        )
      )}
    </p>
  )
}

interface ChatHistorySearchProps {
  query: string
  // Bumped by the parent when chat data changes (e.g. Clear History) so
  // results referencing deleted chats are refetched. Unlike remounting, this
  // preserves the thinking opt-in and refreshes thinking matches as well.
  refreshKey?: number
  // Reports cmdk's active option so the parent can mirror the combobox
  // ARIA (aria-activedescendant) onto the search input, which lives outside
  // the Command scope and therefore cannot use cmdk's own CommandInput.
  onActiveValueChange?: (value: string) => void
}

export function ChatHistorySearch({
  query,
  refreshKey,
  onActiveValueChange
}: ChatHistorySearchProps) {
  const router = useRouter()
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [thinkingRequested, setThinkingRequested] = useState(false)
  const [isSearchingThinking, setIsSearchingThinking] = useState(false)
  // cmdk only reports value changes in controlled mode, so the active option
  // is held here and mirrored to the parent for its combobox ARIA.
  const [activeValue, setActiveValue] = useState('')
  // Monotonic request sequence: responses from superseded queries are dropped
  // so stale results never overwrite the current query's results.
  const requestSeqRef = useRef(0)
  const thinkingAbortRef = useRef<AbortController | null>(null)
  // Distinguishes a refreshKey bump (same query) from a query change, so
  // only refreshes invalidate the currently displayed results.
  const lastQueryRef = useRef(query)

  // The thinking opt-in is scoped to a single search: it resets whenever the
  // query changes, and unmounting discards it entirely (no persistence).
  useEffect(() => {
    setThinkingRequested(false)
    setResults(null)
    setActiveValue('')
    // The options unmount with the query change; notify the parent too or
    // its aria-activedescendant keeps pointing at a removed option (its
    // mirror effect only reruns when the reported value changes).
    onActiveValueChange?.('')
    // An aborted thinking request can no longer update state (its sequence is
    // stale), so the button state must be reset here or it stays stuck.
    setIsSearchingThinking(false)
    return () => {
      thinkingAbortRef.current?.abort()
      thinkingAbortRef.current = null
    }
    // The parent passes a stable state setter, so this dependency never
    // re-triggers the reset.
  }, [query, onActiveValueChange])

  useEffect(() => {
    // Bounded client-side so a pasted passage cannot exceed the request
    // target limit before the server bound takes effect (same normalization
    // as the backend, so results match the same effective query).
    const trimmed = normalizeSearchQuery(query)
    if (effectiveQueryLength(trimmed) < MIN_QUERY_LENGTH) {
      return
    }

    // A refreshKey bump (chat data changed, e.g. Clear History) must not
    // leave stale matches clickable while the refetch is in flight, and a
    // failed refetch must not restore them: invalidate up front and let the
    // refetch repopulate. A query change is already cleared by the reset
    // effect above.
    if (query === lastQueryRef.current) {
      setResults(null)
      // The options are about to unmount; drop the mirrored active option so
      // the parent's aria-activedescendant cannot keep pointing at a removed
      // element (indefinitely if the refetch fails or returns nothing).
      // Notifying with '' when nothing is active is a no-op for the parent.
      setActiveValue('')
      onActiveValueChange?.('')
    }
    lastQueryRef.current = query

    const seq = ++requestSeqRef.current
    const controller = new AbortController()
    setIsSearching(true)

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`)
        }
        const data = (await response.json()) as SearchResponse
        if (seq === requestSeqRef.current) {
          // A thinking response may resolve before this main response;
          // merging keeps the requested thinking section from vanishing.
          setResults(prev =>
            prev?.thinking !== undefined && data.thinking === undefined
              ? { ...data, thinking: prev.thinking }
              : data
          )
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        console.error('History search failed:', error)
        if (seq === requestSeqRef.current) {
          toast.error('Search failed. Please try again.')
        }
      } finally {
        if (seq === requestSeqRef.current) {
          setIsSearching(false)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, refreshKey, onActiveValueChange])

  const handleSearchThinking = useCallback(async () => {
    const trimmed = normalizeSearchQuery(query)
    if (effectiveQueryLength(trimmed) < MIN_QUERY_LENGTH) {
      return
    }

    const seq = requestSeqRef.current
    setThinkingRequested(true)
    setIsSearchingThinking(true)
    thinkingAbortRef.current?.abort()
    const controller = new AbortController()
    thinkingAbortRef.current = controller

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&include=reasoning`,
        { signal: controller.signal }
      )
      if (!response.ok) {
        throw new Error(`Thinking search failed with status ${response.status}`)
      }
      const data = (await response.json()) as SearchResponse
      if (seq === requestSeqRef.current) {
        setResults(prev =>
          prev ? { ...prev, thinking: data.thinking ?? [] } : data
        )
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }
      console.error('Thinking search failed:', error)
      if (seq === requestSeqRef.current) {
        setThinkingRequested(false)
        toast.error('Thinking search failed. Please try again.')
      }
    } finally {
      if (seq === requestSeqRef.current) {
        setIsSearchingThinking(false)
      }
    }
  }, [query])

  // When the parent signals that chat data changed, refresh thinking matches
  // too if the opt-in is active (the main fetch effect refreshes title and
  // content and merges the thinking section in). The refs keep a query change
  // - which resets the opt-in in a separate effect - from re-triggering the
  // thinking search: when the epoch bump lands in the same render as a query
  // edit, `thinkingRequested` still holds the previous query's value here
  // (the reset effect's state update has not applied yet), so the query is
  // compared against the one this refresh was last run for.
  const lastRefreshRef = useRef({ key: refreshKey, query })
  useEffect(() => {
    const prev = lastRefreshRef.current
    const sameQuery = prev.query === query
    lastRefreshRef.current = { key: refreshKey, query }
    if (refreshKey !== prev.key && sameQuery && thinkingRequested) {
      void handleSearchThinking()
    }
  }, [refreshKey, thinkingRequested, handleSearchThinking, query])

  const openChat = useCallback(
    (chatId: string) => {
      router.push(`/search/${chatId}`)
    },
    [router]
  )

  const hasAnyResults =
    !!results &&
    (results.title.length > 0 ||
      results.content.length > 0 ||
      (results.thinking?.length ?? 0) > 0)
  const showEmpty = !isSearching && !!results && !hasAnyResults
  const thinkingItems = results?.thinking
  const showThinkingSection = thinkingRequested && thinkingItems !== undefined
  // Offer the opt-in only once the main results have arrived
  const showThinkingButton = !!results && !isSearching && !showThinkingSection

  return (
    <Command
      shouldFilter={false}
      value={activeValue}
      onValueChange={value => {
        setActiveValue(value)
        onActiveValueChange?.(value)
      }}
      className="bg-transparent p-0"
    >
      <CommandList className="max-h-full">
        {isSearching && !results && (
          <div className="py-2">
            <ChatHistorySkeleton />
          </div>
        )}
        {showEmpty && <CommandEmpty>No matches</CommandEmpty>}
        {results && results.title.length > 0 && (
          <CommandGroup heading="By title">
            {results.title.map(item => (
              <CommandItem
                key={`title-${item.chatId}`}
                value={`title-${item.chatId}`}
                onSelect={() => openChat(item.chatId)}
              >
                <span className="text-xs truncate">{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results && results.content.length > 0 && (
          <CommandGroup heading="In chats">
            {results.content.map(item => (
              <CommandItem
                key={`content-${item.chatId}`}
                value={`content-${item.chatId}`}
                onSelect={() => openChat(item.chatId)}
                className="flex-col items-start gap-0.5"
              >
                <span className="text-xs font-medium truncate w-full">
                  {item.title}
                </span>
                {item.highlight && (
                  <HighlightedSnippet highlight={item.highlight} />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {showThinkingSection && (
          <CommandGroup heading="In thinking">
            {results!.thinking!.length === 0 ? (
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                No thinking matches
              </div>
            ) : (
              results!.thinking!.map(item => (
                <CommandItem
                  key={`thinking-${item.chatId}`}
                  value={`thinking-${item.chatId}`}
                  onSelect={() => openChat(item.chatId)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="text-xs font-medium truncate w-full">
                    {item.title}
                  </span>
                  {item.highlight && (
                    <HighlightedSnippet highlight={item.highlight} />
                  )}
                </CommandItem>
              ))
            )}
          </CommandGroup>
        )}
      </CommandList>
      {showThinkingButton && (
        <button
          type="button"
          onClick={handleSearchThinking}
          onKeyDown={event => {
            // cmdk's root Enter handler would activate the selected result
            // instead of pressing this button; keep the keydown out of the
            // command scope so native button activation applies.
            if (event.key === 'Enter') event.stopPropagation()
          }}
          disabled={isSearchingThinking}
          className="text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors disabled:opacity-60"
        >
          {isSearchingThinking ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          Search thinking
        </button>
      )}
    </Command>
  )
}
