'use client'

import { usePmcResearchMode } from '@/hooks/usePmcResearchMode'
import { ChatMessage } from '@/lib/db'
import { useCustomChat } from '@/lib/hooks/useCustomChat'
import { Model } from '@/lib/types/models'
import { getCookie } from '@/lib/utils/cookies'
import { Message } from 'ai'
import { nanoid } from 'nanoid'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect } from 'react'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

export interface ChatProps {
  id: string
  models?: Model[]
}

export function Chat({ id, models }: ChatProps) {
  const router = useRouter()
  const {
    messages,
    isLoading: isChatLoading,
    error,
    sendMessage,
    clearChat,
    currentChatId,
    setCurrentChatId,
    submitQueryFromOutline,
    addUserMessageOptimistically,
    setMessages
  } = useCustomChat(id)

  const {
    isPmcResearchMode,
    startPmcResearchTask,
    isPollingPmc,
    pmcResearchResultData,
    setPmcResearchResultData,
    setIsPmcResearchMode
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

  useEffect(() => {
    if (id === 'new' && currentChatId) {
      router.replace(`/search/${currentChatId}`, { scroll: false })
    }
  }, [currentChatId, id, router])

  useEffect(() => {
    if (pmcResearchResultData) {
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        {
          id: nanoid(),
          role: 'assistant',
          content: `Resultados da Pesquisa PMC para: "${pmcResearchResultData.query}"`,
          chatId: currentChatId || 'pmc-result',
          createdAt: new Date(),
          pmcResultData: pmcResearchResultData
        }
      ])
      setPmcResearchResultData(null)
    }
  }, [
    pmcResearchResultData,
    currentChatId,
    setPmcResearchResultData,
    setMessages
  ])

  // Memoize the send handler based on the current cookie value
  // Note: This reads the cookie when the component renders or dependencies change.
  // It might still have a slight delay compared to reading *inside* the handler,
  // but separates the logic more cleanly.
  const onSendHandler = useCallback(
    async (input: string) => {
      if (!input.trim()) return

      const currentSearchModeCookie = getCookie('search-mode')
      const isPmcModeActive =
        currentSearchModeCookie !== null
          ? currentSearchModeCookie === 'true'
          : true
      console.log(
        '[onSendHandler] Decided mode from cookie. Active:',
        isPmcModeActive,
        '(Cookie:',
        currentSearchModeCookie,
        ')'
      )

      const userMessageId = addUserMessageOptimistically(input)

      if (isPmcModeActive) {
        console.log('[onSendHandler] Triggering PMC Research Task')
        try {
          await startPmcResearchTask(input)
          // No explicit return needed here if the function ends
        } catch (error) {
          console.error('Error starting PMC research task:', error)
          // Handle error, maybe remove optimistic message?
          // setMessages(prev => prev.filter(msg => msg.id !== userMessageId))
        }
      } else {
        console.log('[onSendHandler] Triggering Standard Chat Send')
        try {
          await sendMessage(input, userMessageId)
        } catch (error) {
          console.error('Error during standard send:', error)
          // Error state is likely handled within sendMessage/useCustomChat already
        }
      }
    },
    [
      addUserMessageOptimistically,
      startPmcResearchTask,
      sendMessage,
      setMessages
    ]
  )

  const handleNewChat = () => {
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
        messages={panelMessages}
        onSend={onSendHandler}
        onNewChat={handleNewChat}
        models={models}
      />
      {error && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-red-500 text-white text-center">
          Error: {error.message}
        </div>
      )}
    </div>
  )
}
