'use client'

import React from 'react'
import { useChatHistory } from '@/lib/utils/chat-history-context'
import { ChatHistoryToggle } from './chat-history-toggle'
import { HistoryList } from './history-list'

type ClientHistoryWrapperProps = {
  userId?: string
}

export function ClientHistoryWrapper({ userId }: ClientHistoryWrapperProps) {
  const { chatHistoryEnabled } = useChatHistory()

  return (
    <>
      <ChatHistoryToggle />
      <HistoryList userId={userId} chatHistoryEnabled={chatHistoryEnabled} />
    </>
  )
}
