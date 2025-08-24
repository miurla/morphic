'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { toast } from 'sonner'

import { generateId } from '@/lib/db/schema'
import { UploadedFile } from '@/lib/types'
import type { UIMessage } from '@/lib/types/ai'
import {
  isDynamicToolPart,
  isToolCallPart,
  isToolTypePart
} from '@/lib/types/dynamic-tools'
import { Model } from '@/lib/types/models'
import { SearchMode } from '@/lib/types/search'
import { cn } from '@/lib/utils'
import { getCookie } from '@/lib/utils/cookies'

import { useAuthCheck } from '@/hooks/use-auth-check'
import { useFileDropzone } from '@/hooks/use-file-dropzone'

import { AuthModal } from './auth-modal'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'
import { DragOverlay } from './drag-overlay'
import { ErrorModal } from './error-modal'

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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [input, setInput] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [errorModal, setErrorModal] = useState<{
    open: boolean
    type: 'rate-limit' | 'auth' | 'forbidden' | 'general'
    message: string
    details?: string
  }>({
    open: false,
    type: 'general',
    message: ''
  })
  const { isAuthenticated } = useAuthCheck()

  // Get search mode from cookie
  const [searchMode, setSearchMode] = useState<SearchMode>('auto')
  
  useEffect(() => {
    const savedMode = getCookie('searchMode')
    if (savedMode && ['quick', 'planning', 'auto'].includes(savedMode)) {
      setSearchMode(savedMode as SearchMode)
    }
  }, [])

  const {
    messages,
    status,
    setMessages,
    stop,
    sendMessage,
    regenerate,
    addToolResult,
    error
  } = useChat({
    id, // use the provided chatId
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages, trigger, messageId }) => {
        // Simplify by passing AI SDK's default trigger values directly
        const lastMessage = messages[messages.length - 1]
        const messageToRegenerate =
          trigger === 'regenerate-message'
            ? messages.find(m => m.id === messageId)
            : undefined

        return {
          body: {
            trigger, // Use AI SDK's default trigger value directly
            chatId: id,
            messageId,
            message:
              trigger === 'regenerate-message' &&
              messageToRegenerate?.role === 'user'
                ? messageToRegenerate
                : trigger === 'submit-message'
                  ? lastMessage
                  : undefined,
            isNewChat: trigger === 'submit-message' && messages.length === 1,
            searchMode // Include search mode in the request
          }
        }
      }
    }),
    messages: savedMessages,
    onFinish: () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    },
    onError: error => {
      // Handle rate limiting errors from Vercel WAF
      // Check for status codes in error message or specific rate limit indicators
      const errorMessage = error.message?.toLowerCase() || ''
      const isRateLimit =
        error.message?.includes('429') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests')

      if (isRateLimit) {
        setErrorModal({
          open: true,
          type: 'rate-limit',
          message: error.message,
          details: undefined
        })
      } else if (
        error.message?.includes('401') ||
        errorMessage.includes('unauthorized')
      ) {
        setErrorModal({
          open: true,
          type: 'auth',
          message: error.message
        })
      } else if (
        error.message?.includes('403') ||
        errorMessage.includes('forbidden')
      ) {
        setErrorModal({
          open: true,
          type: 'forbidden',
          message: error.message
        })
      } else {
        // For general errors, still use toast for less intrusive notification
        toast.error(`Error in chat: ${error.message}`)
      }
    },
    experimental_throttle: 100,
    generateId
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

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
  }, [])

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
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: query }]
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

    try {
      // Update the message locally with the same ID
      setMessages(prevMessages => {
        const messageIndex = prevMessages.findIndex(
          m => m.id === editedMessageId
        )
        if (messageIndex === -1) return prevMessages

        const updatedMessages = [...prevMessages]
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          parts: [{ type: 'text', text: newContentText }]
        }

        return updatedMessages
      })

      // Regenerate from this message
      await regenerate({ messageId: editedMessageId })
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

    try {
      // Use the SDK's regenerate function with the specific messageId
      await regenerate({ messageId: reloadFromFollowerMessageId })
    } catch (error) {
      console.error(
        `Error during reload from message ${reloadFromFollowerMessageId}:`,
        error
      )
      toast.error(`Failed to reload conversation: ${(error as Error).message}`)
    }
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Check authentication before sending message
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    const uploaded = uploadedFiles.filter(f => f.status === 'uploaded')

    if (input.trim() || uploaded.length > 0) {
      const parts: any[] = []

      if (input.trim()) {
        parts.push({ type: 'text', text: input })
      }

      uploaded.forEach(f => {
        parts.push({
          type: 'file',
          url: f.url!,
          filename: f.name!,
          mediaType: f.file.type
        })
      })

      sendMessage({ role: 'user', parts })
      setInput('')
      setUploadedFiles([])

      // Push URL state immediately after sending message (for new chats)
      // Check if we're on the root path (new chat)
      if (window.location.pathname === '/') {
        window.history.pushState({}, '', `/search/${id}`)
      }
    }
  }

  const { isDragging, handleDragOver, handleDragLeave, handleDrop } =
    useFileDropzone({
      uploadedFiles,
      setUploadedFiles,
      chatId: id
    })

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
        addToolResult={({
          toolCallId,
          result
        }: {
          toolCallId: string
          result: any
        }) => {
          // Find the tool name from the message parts
          let toolName = 'unknown'

          // Optimize by breaking early once found
          outerLoop: for (const message of messages) {
            if (!message.parts) continue

            for (const part of message.parts) {
              if (isToolCallPart(part) && part.toolCallId === toolCallId) {
                toolName = part.toolName
                break outerLoop
              } else if (
                isToolTypePart(part) &&
                part.toolCallId === toolCallId
              ) {
                toolName = part.type.substring(5) // Remove 'tool-' prefix
                break outerLoop
              } else if (
                isDynamicToolPart(part) &&
                part.toolCallId === toolCallId
              ) {
                toolName = part.toolName
                break outerLoop
              }
            }
          }

          addToolResult({ tool: toolName, toolCallId, output: result })
        }}
        scrollContainerRef={scrollContainerRef}
        onUpdateMessage={handleUpdateAndReloadMessage}
        reload={handleReloadFrom}
        error={error}
      />
      <ChatPanel
        chatId={id}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={onSubmit}
        status={status}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        query={query}
        append={(message: any) => {
          sendMessage(message)
        }}
        models={models}
        showScrollToBottomButton={!isAtBottom}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        scrollContainerRef={scrollContainerRef}
      />
      <DragOverlay visible={isDragging} />
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      <ErrorModal
        open={errorModal.open}
        onOpenChange={open => setErrorModal(prev => ({ ...prev, open }))}
        error={errorModal}
        onRetry={
          errorModal.type !== 'rate-limit'
            ? () => {
                // Retry the last message if not rate limited
                if (messages.length > 0) {
                  const lastUserMessage = messages
                    .filter(m => m.role === 'user')
                    .pop()
                  if (lastUserMessage) {
                    sendMessage(lastUserMessage)
                  }
                }
              }
            : undefined
        }
      />
    </div>
  )
}
