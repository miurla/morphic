'use client'

import { Message, useChat } from 'ai/react'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'
import { toast } from 'sonner'

export function Chat({
  id,
  savedMessages = [],
  query
}: {
  id: string
  savedMessages?: Message[]
  query?: string
}) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    stop,
    append
  } = useChat({
    initialMessages: savedMessages,
    id: 'chat',
    body: {
      id
    },
    onFinish: () => {
      window.history.replaceState({}, '', `/search/${id}`)
    },
    onError: error => {
      toast.error(`Error in chat: ${error.message}`)
    }
  })

  return (
    <div className="flex flex-col w-full max-w-3xl pt-10 pb-16 mx-auto stretch">
      <ChatMessages
        messages={messages}
        onQuerySelect={query => {
          append({
            role: 'user',
            content: query
          })
        }}
        isLoading={isLoading}
        chatId={id}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        query={query}
        append={append}
      />
    </div>
  )
}
