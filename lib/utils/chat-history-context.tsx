'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getChatHistorySetting, updateChatHistorySetting, getChats } from '@/lib/actions/chat'

interface ChatHistoryContextType {
  chatHistoryEnabled: boolean
  setChatHistoryEnabled: (enabled: boolean) => Promise<void>
  isLoading: boolean
  refreshChatHistory: () => Promise<void>
  chats: any[] // Replace 'any' with a more specific type if available
}

const ChatHistoryContext = createContext<ChatHistoryContextType | undefined>(undefined)

export const useChatHistory = () => {
  const context = useContext(ChatHistoryContext)
  if (!context) {
    throw new Error('useChatHistory must be used within a ChatHistoryProvider')
  }
  return context
}

export const ChatHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chatHistoryEnabled, setChatHistoryEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [chats, setChats] = useState<any[]>([]) // Replace 'any' with a more specific type if available

  const fetchChatHistorySetting = useCallback(async () => {
    const setting = await getChatHistorySetting('anonymous')
    setChatHistoryEnabled(setting)
    setIsLoading(false)
  }, [])

  const fetchChats = useCallback(async () => {
    if (chatHistoryEnabled) {
      const fetchedChats = await getChats('anonymous')
      setChats(fetchedChats)
    } else {
      setChats([])
    }
  }, [chatHistoryEnabled])

  useEffect(() => {
    fetchChatHistorySetting()
  }, [fetchChatHistorySetting])

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  const updateChatHistoryEnabled = async (enabled: boolean) => {
    setIsLoading(true)
    await updateChatHistorySetting('anonymous', enabled)
    setChatHistoryEnabled(enabled)
    setIsLoading(false)
    await fetchChats()
  }

  const refreshChatHistory = async () => {
    await fetchChats()
  }

  return (
    <ChatHistoryContext.Provider
      value={{
        chatHistoryEnabled,
        setChatHistoryEnabled: updateChatHistoryEnabled,
        isLoading,
        refreshChatHistory,
        chats
      }}
    >
      {children}
    </ChatHistoryContext.Provider>
  )
}
