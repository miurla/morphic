'use client'

import { createContext, useContext } from 'react'

type ChatContextValue = {
  sendMessage: (message: {
    role: 'user'
    parts: Array<{ type: 'text'; text: string }>
  }) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({
  sendMessage,
  children
}: ChatContextValue & { children: React.ReactNode }) {
  return (
    <ChatContext.Provider value={{ sendMessage }}>
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
