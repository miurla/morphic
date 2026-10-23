'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  IconLoader2 as Loader2,
  IconSparkles as Sparkles
} from '@tabler/icons-react'
import { toast } from 'sonner'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList
} from '@/components/ui/command'

import { ChatHistorySkeleton } from './chat-history-skeleton'

const DEBOUNCE_MS = 250
const MIN_QUERY_LENGTH = 2

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

// Renders a ts_headline snippet, emphasizing the <b></b>-marked match terms.
// The markers are parsed into elements (never injected as HTML).
function HighlightedSnippet({ highlight }: { highlight: string }) {
  const segments = highlight.split(/(<b>[\s\S]*?<\/b>)/g)
  return (
    <p className="text-muted-foreground text-xs leading-snug break-words line-clamp-2 w-full">
      {segments.map((segment, index) =>
        segment.startsWith('<b>') && segment.endsWith('</b>') ? (
          <b key={index} className="font-semibold text-foreground">
            {segment.slice(3, -4)}
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
}

export function ChatHistorySearch({ query }: ChatHistorySearchProps) {
  const router = useRouter()
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [thinkingRequested, setThinkingRequested] = useState(false)
  const [isSearchingThinking, setIsSearchingThinking] = useState(false)
  // Monotonic request sequence: responses from superseded queries are dropped
  // so stale results never overwrite the current query's results.
  const requestSeqRef = useRef(0)
  const thinkingAbortRef = useRef<AbortController | null>(null)

  // The thinking opt-in is scoped to a single search: it resets whenever the
  // query changes, and unmounting discards it entirely (no persistence).
  useEffect(() => {
    setThinkingRequested(false)
    setResults(null)
    return () => {
      thinkingAbortRef.current?.abort()
      thinkingAbortRef.current = null
    }
  }, [query])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return
    }

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
  }, [query])

  const handleSearchThinking = useCallback(async () => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
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

  return (
    <Command shouldFilter={false} className="bg-transparent p-0">
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
      {!showThinkingSection && (
        <button
          type="button"
          onClick={handleSearchThinking}
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
