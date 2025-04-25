'use client'

import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClearHistory } from './clear-history'
import HistoryItem from './history-item'

export function HistoryList() {
  const chats = useLiveQuery(() => db.listChats(), [])

  return (
    <div className="flex flex-col flex-1 space-y-3 h-full">
      <div className="flex flex-col space-y-0.5 flex-1 overflow-y-auto">
        {chats === undefined && (
          <div className="text-foreground/30 text-sm text-center py-4">
            Carregando conversas...
          </div>
        )}
        {chats && chats.length === 0 && (
          <div className="text-foreground/30 text-sm text-center py-4">
            Nenhuma conversa
          </div>
        )}
        {chats &&
          chats.length > 0 &&
          chats.map(chat => <HistoryItem key={chat.id} chat={chat} />)}
      </div>
      <div className="mt-auto">
        <ClearHistory empty={!chats?.length} />
      </div>
    </div>
  )
}
