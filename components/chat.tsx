'use client'

import { Message, useChat } from 'ai/react'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

export function Chat({
  id,
  savedMessages = []
}: {
  id: string
  savedMessages?: Message[]
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
    body: {
      id
    },
    onFinish: () => {
      // window.history.replaceState({}, '', `/search/${id}`)
    }
  })

  console.log(JSON.stringify(messages, null, 2))

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
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
      />
    </div>
  )
}
