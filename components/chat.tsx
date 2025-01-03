'use client'

import { useChat } from 'ai/react'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { models } from '@/lib/types/models'
import { getDefaultModelId } from '@/lib/utils'
import { Spinner } from './ui/spinner'

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
    stop,
    append
  } = useChat({
    body: {
      model: selectedModelId
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
