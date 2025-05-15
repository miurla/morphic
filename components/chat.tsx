'use client'

import { deleteTrailingMessages } from '@/lib/actions/chat-db'
import { CHAT_ID } from '@/lib/constants'
import { useAutoScroll } from '@/lib/hooks/use-auto-scroll'
import { Model } from '@/lib/types/models'
import { cn, generateUUID } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { ChatRequestOptions, Message as UIMessage } from 'ai'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useTransition } from 'react'
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
  savedMessages?: UIMessage[]
  query?: string
  models?: Model[]
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

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
    onFinish: () => {
      window.history.replaceState({}, '', `/search/${id}`)
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    },
    onError: error => {
      toast.error(`Error in chat: ${error.message}`)
    },
    sendExtraMessageFields: false,
    experimental_throttle: 100,
    generateId: generateUUID,
    experimental_prepareRequestBody: body => ({
      id,
      message: body.messages.at(-1)
    })
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  const {
    anchorRef,
    isAutoScroll,
    enable: enableAutoScroll
  } = useAutoScroll({
    isLoading,
    dependency: messages.length,
    isStreaming: status === 'streaming',
    scrollContainer: scrollContainerRef,
    threshold: 70
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

  const handleUpdateAndReloadMessage = async (
    editedMessageId: string,
    newContentText: string
  ) => {
    if (!id) {
      toast.error('Chat ID is missing.')
      console.error(
        'handleUpdateAndReloadMessage: chatId (id prop) is undefined.'
      )
      return
    }

    const pivotMessage = messages.find(m => m.id === editedMessageId)
    if (!pivotMessage) {
      toast.error('Original message not found to edit locally.')
      console.error(
        'handleUpdateAndReloadMessage: Pivot message not found for timestamp.'
      )
      return
    }
    const pivotTimestamp =
      pivotMessage.createdAt?.toISOString() ?? new Date(0).toISOString()

    try {
      setMessages(prevMessages => {
        const messageIndex = prevMessages.findIndex(
          m => m.id === editedMessageId
        )
        const messagesBeforeEdited =
          messageIndex !== -1
            ? prevMessages.slice(0, messageIndex)
            : prevMessages

        const newUIMessage: UIMessage = {
          id: generateUUID(),
          role: 'user',
          content: newContentText,
          parts: [{ type: 'text', text: newContentText }],
          createdAt: new Date()
        }

        return [...messagesBeforeEdited, newUIMessage]
      })

      await deleteTrailingMessages(id, pivotTimestamp)
      await reload()
    } catch (error) {
      console.error('Error during message edit and reload process:', error)
      toast.error(
        `Error processing edited message: ${(error as Error).message}`
      )
    }
  }

  const handleReloadFrom = async (
    messageId: string,
    options?: ChatRequestOptions
  ) => {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      const userMessageIndex = messages
        .slice(0, messageIndex + 1)
        .findLastIndex(m => m.role === 'user')
      if (userMessageIndex !== -1) {
        const trimmedMessages = messages.slice(0, userMessageIndex + 1)
        setMessages(trimmedMessages)
        return await reload(options)
      }
    }
    return await reload(options)
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setData(undefined)
    handleSubmit(e)
  }

  return (
    <div
      className={cn(
        'relative flex h-full min-w-0 flex-1 flex-col',
        messages.length === 0 ? 'items-center justify-center' : ''
      )}
      data-testid="full-chat"
    >
      <ChatMessages
        messages={messages}
        data={data}
        onQuerySelect={onQuerySelect}
        isLoading={isLoading}
        chatId={id}
        addToolResult={addToolResult}
        anchorRef={anchorRef}
        scrollContainerRef={scrollContainerRef}
        onUpdateMessage={handleUpdateAndReloadMessage}
        reload={handleReloadFrom}
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
