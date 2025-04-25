'use client'

import { useCustomChat } from '@/lib/hooks/useCustomChat'
import { Model } from '@/lib/types/models'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
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
    isLoading,
    error,
    sendMessage,
    clearChat,
    currentChatId,
    setCurrentChatId
  } = useCustomChat(id)

  useEffect(() => {
    if (id === 'new' && currentChatId) {
      router.replace(`/search/${currentChatId}`, { scroll: false })
    }
  }, [currentChatId, id, router])

  const handleSendMessage = async (input: string) => {
    if (input.trim()) {
      await sendMessage(input)
    }
  }

  const handleNewChat = () => {
    router.push('/search')
  }

  return (
    <div className="flex flex-col w-full max-w-3xl pt-14 pb-32 mx-auto stretch">
      <ChatMessages messages={messages} isLoading={isLoading} />
      <ChatPanel
        isLoading={isLoading}
        messages={messages}
        onSend={handleSendMessage}
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
