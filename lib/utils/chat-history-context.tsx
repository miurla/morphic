'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getChatHistorySetting, updateChatHistorySetting, getChats } from '@/lib/actions/chat'

interface ChatHistoryContextType {
  chatHistoryEnabled: boolean
  setChatHistoryEnabled: (enabled: boolean) => Promise<void>
  isLoading: boolean
  refreshChatHistory: () => Promise<void>
  chats: any[]
  storageAvailable: boolean 
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
  const [chatHistoryEnabled, setChatHistoryEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [chats, setChats] = useState<any[]>([])
  const [storageAvailable, setStorageAvailable] = useState(false) 
  const cachedChatsRef = useRef<any[]>([])

  const fetchChatHistorySetting = useCallback(async () => {
    try {
      // Check storage provider setting first
      if (process.env.STORAGE_PROVIDER === 'none') {
        setStorageAvailable(false)
        setChatHistoryEnabled(false)
        setIsLoading(false)
        return
      }

      const setting = await getChatHistorySetting('anonymous')
      // Only set storage as available if we get a valid response
      if (setting === null) {
        setStorageAvailable(false)
        setChatHistoryEnabled(false)
      } else {
        setStorageAvailable(true)
        setChatHistoryEnabled(setting)
      }
    } catch (error) {
      console.error('Error fetching chat history setting:', error)
      setStorageAvailable(false)
      setChatHistoryEnabled(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchChats = useCallback(async () => {
    if (chatHistoryEnabled) {
      try {
        // Show cached chats immediately if available
        if (cachedChatsRef.current.length > 0) {
          setChats(cachedChatsRef.current)
        }
        
        // Fetch new chats in background
        const fetchedChats = await getChats('anonymous')
        if (fetchedChats && fetchedChats.length > 0) {
          setChats(fetchedChats)
          cachedChatsRef.current = fetchedChats // Update cache
        }
      } catch (error) {
        console.error('Error fetching chats:', error)
        // On error, keep showing cached chats if available
        if (cachedChatsRef.current.length > 0) {
          setChats(cachedChatsRef.current)
        }
      }
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
        chats,
        storageAvailable
      }}
    >
      {children}
    </ChatHistoryContext.Provider>
  )
}
