'use client'

import { CHAT_ID } from '@/lib/constants'
import { useAutoScroll } from '@/lib/hooks/use-auto-scroll'
import { Model } from '@/lib/types/models'
import { useChat } from '@ai-sdk/react'
import { Message } from 'ai/react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

export function Chat({
  id,
  savedMessages = [],
  query,
  models
}: {
  id: string
  savedMessages?: Message[]
  query?: string
  models?: Model[]
}) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    setMessages,
    stop,
    append,
    data,
    setData,
    addToolResult,
    reload
  } = useChat({
    initialMessages: savedMessages,
    id: CHAT_ID,
    body: {
      id
    },
    onFinish: () => {
      window.history.replaceState({}, '', `/search/${id}`)
    },
    onError: error => {
      toast.error(`Error in chat: ${error.message}`)
    },
    sendExtraMessageFields: false, // Disable extra message fields,
    experimental_throttle: 100
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Manage auto-scroll and user scroll cancel
  const { anchorRef, isAutoScroll } = useAutoScroll({
    isLoading,
    dependency: messages.length,
    isStreaming: () => status === 'streaming'
  })

  useEffect(() => {
    setMessages(savedMessages)
  }, [id])

  const onQuerySelect = (query: string) => {
    append({
      role: 'user',
      content: query
    })
  }

  // Function to update message content and reload the conversation
  const handleUpdateAndReloadMessage = async (
    messageId: string,
    newContent: string
  ) => {
    // Update the message with new content
    setMessages(currentMessages =>
      currentMessages.map(msg =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      )
    )

    try {
      // Find the updated message's index
      const messageIndex = messages.findIndex(msg => msg.id === messageId)
      if (messageIndex === -1) return

      // Keep only messages up to that point
      const messagesUpToEdited = messages.slice(0, messageIndex + 1)

      // Update messages to include only up to the edited message
      setMessages(messagesUpToEdited)

      // Reset data to clear any tool calls
      setData(undefined)

      // Regenerate the conversation using reload
      await reload({
        body: {
          chatId: id,
          regenerate: true
        }
      })
    } catch (error) {
      console.error('Failed to reload after message update:', error)
      toast.error(`Failed to reload conversation: ${(error as Error).message}`)
    }
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setData(undefined) // reset data to clear tool call
    handleSubmit(e)
  }

  return (
    <div className="flex flex-col w-full max-w-3xl pt-14 pb-32 mx-auto stretch">
      <ChatMessages
        messages={messages}
        data={data}
        onQuerySelect={onQuerySelect}
        isLoading={isLoading}
        chatId={id}
        addToolResult={addToolResult}
        anchorRef={anchorRef}
        onUpdateMessage={handleUpdateAndReloadMessage}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={onSubmit}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        query={query}
        append={append}
        models={models}
        isAutoScroll={isAutoScroll}
      />
    </div>
  )
}
