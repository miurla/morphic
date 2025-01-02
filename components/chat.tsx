'use client'

import { useChat } from 'ai/react'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { models } from '@/lib/types/models'
import { getDefaultModelId } from '@/lib/utils'

export function Chat() {
  const [selectedModelId, setSelectedModelId] = useLocalStorage<string>(
    'selectedModel',
    getDefaultModelId(models)
  )

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    stop
  } = useChat({
    body: {
      model: selectedModelId
    }
  })

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
