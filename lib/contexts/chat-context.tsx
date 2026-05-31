'use client'

import type { MutableRefObject } from 'react'
import { createContext, useContext } from 'react'

type ChatContextValue = {
  sendMessage: (message: {
    role: 'user'
    parts: Array<{ type: 'text'; text: string }>
  }) => void
  // Ref (not state) so reads via `.current` always see the freshest
  // value, even when the consumer is downstream of
  // @json-render/react's ActionProvider — which captures its handlers
  // prop into useState(initialHandlers) and never refreshes them,
  // making any React-state value read through closure go stale on the
  // very next render. Maintained by chat.tsx: set to true inside
  // safeSendMessage, cleared inside useChat's onFinish / onError.
  isStreamingRef: MutableRefObject<boolean>
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({
  sendMessage,
  isStreamingRef,
  children
}: ChatContextValue & { children: React.ReactNode }) {
  return (
    <ChatContext.Provider value={{ sendMessage, isStreamingRef }}>
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
