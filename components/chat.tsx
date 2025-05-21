'use client'

import { useFileDropzone } from '@/hooks/use-file-dropzone'
import { deleteTrailingMessages } from '@/lib/actions/chat-db'
import { Model } from '@/lib/types/models'
import { cn, generateUUID } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { UIMessage, defaultChatStore } from 'ai'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'
import { DragOverlay } from './drag-overlay'

// Define section structure
interface ChatSection {
  id: string // User message ID
  userMessage: UIMessage
  assistantMessages: UIMessage[]
}

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
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

  const chatStore: any = defaultChatStore({
    api: '/api/chat',
    messageMetadataSchema: z.object({
      createdAt: z.date()
    }),
    chats: {
      [id]: {
        messages: savedMessages
      }
    },
    prepareRequestBody: (body: any) => {
      return {
        chatId: body.chatId,
        message: body.messages.at(-1)
      }
    }
  })

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    setMessages,
    stop,
    append,
    addToolResult,
    reload
  } = useChat({
    chatId: id,
    onFinish: () => {
      window.history.replaceState({}, '', `/search/${id}`)
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    },
    onError: error => {
      toast.error(`Error in chat: ${error.message}`)
    },
    experimental_throttle: 100,
    chatStore,
    generateId: generateUUID
  })

  // Convert messages array to sections array
  const sections = useMemo<ChatSection[]>(() => {
    const result: ChatSection[] = []
    let currentSection: ChatSection | null = null

    for (const message of messages) {
      if (message.role === 'user') {
        // Start a new section when a user message is found
        if (currentSection) {
          result.push(currentSection)
        }
        currentSection = {
          id: message.id,
          userMessage: message,
          assistantMessages: []
        }
      } else if (currentSection && message.role === 'assistant') {
        // Add assistant message to the current section
        currentSection.assistantMessages.push(message)
      }
      // Ignore other role types like 'system' for now
    }

    // Add the last section if exists
    if (currentSection) {
      result.push(currentSection)
    }

    return result
  }, [messages])

  // Detect if scroll container is at the bottom
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const threshold = 50 // threshold in pixels
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        setIsAtBottom(true)
      } else {
        setIsAtBottom(false)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Set initial state

    return () => container.removeEventListener('scroll', handleScroll)
  }, [scrollContainerRef.current])

  // Scroll to the section when a new user message is sent
  useEffect(() => {
    if (sections.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.role === 'user') {
        // If the last message is from user, find the corresponding section
        const sectionId = lastMessage.id
        requestAnimationFrame(() => {
          const sectionElement = document.getElementById(`section-${sectionId}`)
          sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
  }, [sections, messages])

  const onQuerySelect = (query: string) => {
    append({
      role: 'user',
      parts: [{ type: 'text', text: query }],
      id: generateUUID()
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
      (
        pivotMessage.metadata as { createdAt?: Date }
      )?.createdAt?.toISOString() ?? new Date(0).toISOString()

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
          parts: [{ type: 'text', text: newContentText }]
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

  const handleReloadFrom = async (reloadFromFollowerMessageId: string) => {
    if (!id) {
      toast.error('Chat ID is missing for reload.')
      return
    }

    const followerMessageIndex = messages.findIndex(
      m => m.id === reloadFromFollowerMessageId
    )

    if (followerMessageIndex < 1) {
      toast.error(
        'Cannot reload: No preceding message found or message is the first.'
      )
      console.error(
        `handleReloadFrom: No message found before id ${reloadFromFollowerMessageId} or it is the first message.`
      )
      return
    }

    const targetUserMessageIndex = followerMessageIndex - 1
    const targetUserMessage = messages[targetUserMessageIndex]

    if (targetUserMessage.role !== 'user') {
      toast.error(
        'Cannot reload: The message to resend must be a user message.'
      )
      console.error(
        `handleReloadFrom: Preceding message (id: ${targetUserMessage.id}) is not a user message.`
      )
      return
    }

    const deletionTimestamp =
      (
        targetUserMessage.metadata as { createdAt?: Date }
      )?.createdAt?.toISOString() ?? new Date(0).toISOString()

    const contentToResend =
      targetUserMessage.parts
        ?.filter(p => p.type === 'text')
        .map(p => p.text)
        .join('') || ''

    try {
      setMessages(prevMessages => {
        const messagesBeforeTarget = prevMessages.slice(
          0,
          targetUserMessageIndex
        )

        const newResentUserMessage: UIMessage = {
          id: generateUUID(),
          role: 'user',
          parts: [{ type: 'text', text: contentToResend }]
        }
        return [...messagesBeforeTarget, newResentUserMessage]
      })

      await deleteTrailingMessages(id, deletionTimestamp)
      await reload()
    } catch (error) {
      console.error(
        `Error during reload from message preceding ${reloadFromFollowerMessageId}:`,
        error
      )
      toast.error(`Failed to reload conversation: ${(error as Error).message}`)
    }
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const uploadedAttachments = await Promise.all(
      uploadedFiles.map(async file => {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })
        if (!res.ok) {
          const errorData = await res.json()
          toast.error(`Upload failed: ${errorData.error || 'Unknown error'}`)
          return null
        }
        const { file: uploadedFile } = await res.json()
        return uploadedFile // contains name, url, contentType, key
      })
    )
    const validAttachments = uploadedAttachments.filter(Boolean) // remove failed uploads
    handleSubmit(e, {
      files: validAttachments
    })

    setUploadedFiles([])
  }

  const { isDragging, handleDragOver, handleDragLeave, handleDrop } =
    useFileDropzone({
      uploadedFiles,
      setUploadedFiles
    })
  console.log('id', id)

  return (
    <div
      className={cn(
        'relative flex h-full min-w-0 flex-1 flex-col',
        messages.length === 0 ? 'items-center justify-center' : ''
      )}
      data-testid="full-chat"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ChatMessages
        sections={sections}
        onQuerySelect={onQuerySelect}
        status={status}
        chatId={id}
        addToolResult={addToolResult}
        scrollContainerRef={scrollContainerRef}
        onUpdateMessage={handleUpdateAndReloadMessage}
        reload={handleReloadFrom}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={onSubmit}
        status={status}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        query={query}
        append={append}
        models={models}
        showScrollToBottomButton={!isAtBottom}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        scrollContainerRef={scrollContainerRef}
      />
      <DragOverlay visible={isDragging} />
    </div>
  )
}
