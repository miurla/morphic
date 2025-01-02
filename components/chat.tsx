'use client'

import { useChat } from 'ai/react'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

export function Chat() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    stop
  } = useChat()

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <ChatMessages messages={messages} />
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
