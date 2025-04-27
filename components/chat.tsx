'use client'

import { usePmcResearchMode } from '@/hooks/usePmcResearchMode'
import { ChatMessage, db } from '@/lib/db'
import { useCustomChat } from '@/lib/hooks/useCustomChat'
import { useAppStore } from '@/lib/store'
import { Model } from '@/lib/types/models'
import { useQueryClient } from '@tanstack/react-query'
import { Message } from 'ai'
import { nanoid } from 'nanoid'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

export interface ChatProps {
  id: string
  models?: Model[]
  savedMessages?: Message[]
}

export function Chat({ id, models, savedMessages }: ChatProps) {
  console.log('[Chat Component] Rendering with props:', {
    id,
    models: models?.length,
    hasSavedMessages: !!savedMessages
  }) // Log props
  const router = useRouter()

  // Use Zustand store for PMC mode state
  const isPmcModeActiveFromStore = useAppStore(state => state.isPmcResearchMode)

  // Call initializePmcModeFromCookie once on mount
  const pmcCookieInitialized = useRef(false) // Ref to track initialization
  useEffect(() => {
    if (!pmcCookieInitialized.current) {
      useAppStore.getState().initializePmcModeFromCookie()
      pmcCookieInitialized.current = true
    }
  }, []) // Empty array ensures it runs only on mount

  const {
    messages,
    isLoading: isChatLoading,
    error,
    sendMessage,
    clearChat,
    submitQueryFromOutline,
    addUserMessageOptimistically
  } = useCustomChat(id, savedMessages)

  // Use polling state and result data from the hook
  const {
    startPmcResearchTask,
    isPollingPmc,
    pmcResearchResultData,
    setPmcResearchResultData
  } = usePmcResearchMode()

  const panelMessages: Message[] = messages
    .filter(
      msg =>
        msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system'
    )
    .map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }))

  // Restore router effect
  // Use store's currentChatId for router logic
  const storeChatIdForRouter = useAppStore(state => state.currentChatId)
  useEffect(() => {
    console.log(
      `[Chat Router Effect] Running. ID Prop: ${id}, Store Chat ID: ${storeChatIdForRouter}`
    )
    if (id === 'new' && storeChatIdForRouter) {
      console.log(
        `[Chat Router Effect] Replacing route to /search/${storeChatIdForRouter}`
      )
      router.replace(`/search/${storeChatIdForRouter}`, { scroll: false })
    }
  }, [storeChatIdForRouter, id, router]) // Depend on store ID

  // Restore PMC result effect
  const queryClient = useQueryClient() // Get query client
  const storeCurrentChatId = useAppStore(state => state.currentChatId)
  useEffect(() => {
    if (pmcResearchResultData) {
      console.log(
        '[Chat PMC Result Effect] Received PMC result. Invalidating chat query for:',
        storeCurrentChatId
      )
      // Instead of directly setting messages, add the result to the DB
      // (assuming you might want to persist it) and invalidate the query.
      // This example assumes pmcResultData needs to be added as a message.
      // Adjust this logic based on how PMC results should actually be integrated.
      const addPmcResultAsMessage = async () => {
        if (!storeCurrentChatId) return // Cannot add message without a chat ID
        const assistantMessage: ChatMessage = {
          id: nanoid(),
          role: 'assistant',
          content: `Resultados da Pesquisa PMC para: "${
            pmcResearchResultData.query
          }"\n${pmcResearchResultData.summary || ''}`.trim(),
          chatId: storeCurrentChatId,
          createdAt: new Date(),
          pmcResultData: pmcResearchResultData // Store the full data
        }
        try {
          await db.addChatMessage(assistantMessage)
          queryClient.invalidateQueries({
            queryKey: ['chats', 'detail', storeCurrentChatId] // Use the specific query key
          })
        } catch (dbError) {
          console.error('Error saving PMC result message to DB:', dbError)
        }
        setPmcResearchResultData(null) // Clear the result data after processing
      }
      addPmcResultAsMessage()
    }
  }, [
    pmcResearchResultData,
    storeCurrentChatId,
    setPmcResearchResultData,
    queryClient // Add queryClient dependency
  ])

  // Updated send handler
  const onSendHandler = useCallback(
    async (input: string) => {
      if (!input.trim()) return

      // Read PMC mode directly from the store state
      const isPmcMode = useAppStore.getState().isPmcResearchMode
      console.log(
        '[onSendHandler] Decided mode from Zustand store. Active:',
        isPmcMode
      )

      const userMessageId = addUserMessageOptimistically(input)

      if (isPmcMode) {
        console.log('[onSendHandler] Triggering PMC Research Task')
        try {
          await startPmcResearchTask(input)
        } catch (error) {
          console.error('Error starting PMC research task:', error)
        }
      } else {
        console.log('[onSendHandler] Triggering Standard Chat Send')
        try {
          await sendMessage(input)
        } catch (error) {
          console.error('Error during standard send:', error)
        }
      }
    },
    // Dependencies: actions from hooks, but not the Zustand state itself
    [addUserMessageOptimistically, startPmcResearchTask, sendMessage]
  )

  const handleNewChat = () => {
    // When creating a new chat, reset the store's currentChatId
    useAppStore.getState().setCurrentChatId(null)
    router.push('/search')
  }

  return (
    <div className="flex flex-col w-full max-w-3xl pt-14 pb-32 mx-auto stretch">
      <ChatMessages
        messages={messages}
        isLoading={isChatLoading}
        submitQueryFromOutline={submitQueryFromOutline}
      />
      <ChatPanel
        isLoading={isChatLoading}
        messages={messages
          .filter(
            m =>
              m.role === 'user' || m.role === 'assistant' || m.role === 'system'
          )
          .map(msg => ({
            id: msg.id,
            role: msg.role as any,
            content: msg.content
          }))}
        onSend={onSendHandler}
        onNewChat={handleNewChat}
        models={models}
      />
      {error && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-red-500 text-white text-center">
          Error: {error instanceof Error ? error.message : String(error)}
        </div>
      )}
    </div>
  )
}
