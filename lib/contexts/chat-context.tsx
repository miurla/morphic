'use client'

import { createContext, useContext } from 'react'

export type SelectedItem = {
  id: string
  type: 'job' | 'person'
  title: string
  subtitle?: string
  url?: string
  data?: Record<string, unknown>
}

type ChatContextValue = {
  sendMessage: (message: {
    role: 'user'
    parts: Array<{ type: 'text'; text: string }>
  }) => void
  selectedItem: SelectedItem | null
  setSelectedItem: (item: SelectedItem | null) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({
  sendMessage,
  selectedItem,
  setSelectedItem,
  children
}: {
  sendMessage: ChatContextValue['sendMessage']
  selectedItem: SelectedItem | null
  setSelectedItem: (item: SelectedItem | null) => void
  children: React.ReactNode
}) {
  return (
    <ChatContext.Provider value={{ sendMessage, selectedItem, setSelectedItem }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}
