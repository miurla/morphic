'use client'

import { useChat } from 'ai/react'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

export function Chat({ id }: { id: string }) {
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
    body: {
      id
    },
    onFinish: () => {
      // window.history.replaceState({}, '', `/search/${id}`)
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
