'use client'

import React, { useEffect, useState } from 'react'
import HistoryItem from './history-item'
import { Chat } from '@/lib/types'
import { getChats } from '@/lib/actions/chat'
import { ClearHistory } from './clear-history'

type HistoryListProps = {
  userId?: string
  chatHistoryEnabled: boolean
}

export function HistoryList({ userId, chatHistoryEnabled }: HistoryListProps) {
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadChats = async () => {
      if (!chatHistoryEnabled) {
        setChats([])
        setIsLoading(false)
        return
      }

      try {
        const fetchedChats = await getChats(userId)
        if (fetchedChats) {
          setChats(fetchedChats)
          setError(false)
        }
      } catch (error) {
        console.error('Error fetching chats:', error)
        setError(true)
        // Don't clear existing chats on error
      } finally {
        setIsLoading(false)
      }
    }

    loadChats()
  }, [userId, chatHistoryEnabled])

  if (!chatHistoryEnabled) {
    return (
      <div className="text-foreground/30 text-sm text-center py-4">
        Chat history is disabled
      </div>
    )
  }

  if (isLoading && chats.length === 0) {
    return <div className="text-sm text-center py-4">Loading...</div>
  }

  return (
    <div className="flex flex-col flex-1 space-y-3 h-full">
      <div className="flex flex-col space-y-0.5 flex-1 overflow-y-auto">
        {!chats?.length ? (
          <div className="text-foreground/30 text-sm text-center py-4">
            No search history
          </div>
        ) : (
          chats?.map(
            (chat: Chat) => chat && <HistoryItem key={chat.id} chat={chat} />
          )
        )}
      </div>

      <div className="sticky bottom-0 bg-background py-2">
        <ClearHistory empty={!chats?.length} onCleared={() => setChats([])} />
      </div>
    </div>
  )
}
