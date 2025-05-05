'use client'

import { SidebarMenu } from '@/components/ui/sidebar'
import { Chat } from '@/lib/types'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ChatHistorySkeleton } from './chat-history-skeleton'
import { ChatMenuItem } from './chat-menu-item'

interface ChatHistoryClientProps {
  initialChats: Chat[]
  initialNextOffset: number | null
}

interface ChatPageResponse {
  chats: Chat[]
  nextOffset: number | null
}

export function ChatHistoryClient({
  initialChats,
  initialNextOffset
}: ChatHistoryClientProps) {
  const [chats, setChats] = useState<Chat[]>(initialChats)
  const [nextOffset, setNextOffset] = useState<number | null>(initialNextOffset)
  const [isLoading, setIsLoading] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [isPending, startTransition] = useTransition()

  // Synchronize state with props when initial data changes (e.g., after router.refresh)
  useEffect(() => {
    setChats(initialChats)
    setNextOffset(initialNextOffset)
  }, [initialChats, initialNextOffset])

  const fetchMoreChats = useCallback(async () => {
    if (isLoading || nextOffset === null) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats?offset=${nextOffset}&limit=20`)
      if (!response.ok) {
        throw new Error('Failed to fetch chat history')
      }
      const { chats: newChats, nextOffset: newNextOffset } =
        (await response.json()) as ChatPageResponse

      startTransition(() => {
        setChats(prevChats => [...prevChats, ...newChats])
        setNextOffset(newNextOffset)
      })
    } catch (error) {
      console.error('Failed to load more chats:', error)
      toast.error('Failed to load more chat history.')
      // Optionally stop trying to load more if there's an error
      setNextOffset(null)
    } finally {
      setIsLoading(false)
    }
  }, [nextOffset, isLoading])

  useEffect(() => {
    const observerRefValue = loadMoreRef.current
    if (!observerRefValue || nextOffset === null) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoading) {
          fetchMoreChats()
        }
      },
      { threshold: 0.1 } // Trigger when 10% visible
    )

    observer.observe(observerRefValue)

    return () => {
      if (observerRefValue) {
        observer.unobserve(observerRefValue)
      }
    }
  }, [fetchMoreChats, nextOffset, isLoading])

  return (
    <div className="flex-1 overflow-y-auto mb-2 relative">
      {!chats?.length && !isLoading && nextOffset === null ? (
        <div className="px-2 text-foreground/30 text-sm text-center py-4">
          No search history
        </div>
      ) : (
        <SidebarMenu>
          {chats.map(
            (chat: Chat) => chat && <ChatMenuItem key={chat.id} chat={chat} />
          )}
        </SidebarMenu>
      )}

      {/* Sentinel Element */}
      <div ref={loadMoreRef} style={{ height: '1px' }} />

      {/* Loading Skeleton/Spinner */}
      {(isLoading || isPending) && (
        <div className="py-2">
          <ChatHistorySkeleton />
        </div>
      )}
    </div>
  )
}
