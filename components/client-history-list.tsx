'use client'

import React, { Suspense } from 'react'
import { useChatHistory } from '@/lib/utils/chat-history-context'
import { ChatHistoryToggle } from './chat-history-toggle'
import { HistoryList } from './history-list'

type ClientHistoryListProps = {
  userId?: string
}

export default function ClientHistoryList(props: ClientHistoryListProps) {
  const { chatHistoryEnabled } = useChatHistory()

  return (
    <>
      <ChatHistoryToggle />
      <Suspense fallback={<div>Loading...</div>}>

        <HistoryList{...props} chatHistoryEnabled={chatHistoryEnabled} />
      </Suspense>
    </>
  )
}
