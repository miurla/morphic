'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { toast } from 'sonner'

import { summarizeGenui } from '@/lib/analytics/genui-summary'
import { captureClient, getDistinctId } from '@/lib/analytics/posthog-client'
import { ChatProvider } from '@/lib/contexts/chat-context'
import { generateId } from '@/lib/db/schema'
import {
  getPublicRateLimitDetails,
  toPublicErrorPayload
} from '@/lib/errors/public-error'
import { SHORTCUT_EVENTS } from '@/lib/keyboard-shortcuts'
import { stripSpecBlocks } from '@/lib/render/strip-spec-blocks'
import {
  ADAPTIVE_MODE_AUTH_REQUIRED_MESSAGE,
  isAdaptiveModeAuthBlocked
} from '@/lib/search-mode-availability'
import { UploadedFile } from '@/lib/types'
import type { UIMessage } from '@/lib/types/ai'
import {
  isDynamicToolPart,
  isToolCallPart,
  isToolTypePart
} from '@/lib/types/dynamic-tools'
import type { ModelSelectorData } from '@/lib/types/model-selector'
import { cn } from '@/lib/utils'
import { getCookie } from '@/lib/utils/cookies'
import { getTextFromParts } from '@/lib/utils/message-utils'

import { useFileDropzone } from '@/hooks/use-file-dropzone'

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
  id: providedId,
  savedMessages = [],
  query,
  isGuest = false,
  isCloudDeployment = false,
  modelSelectorData
}: {
  id?: string
  savedMessages?: UIMessage[]
  query?: string
  isGuest?: boolean
  isCloudDeployment?: boolean
  modelSelectorData?: ModelSelectorData
}) {
  const router = useRouter()

  // Generate a stable chatId on the client side
  // - If providedId exists (e.g., /search/[id]), use it for existing chats
  // - Otherwise, generate a new ID (e.g., / homepage for new chats)
  const [chatId, setChatId] = useState(() => providedId || generateId())

  // Callback to reset chat state when user clicks "New" button
  const handleNewChat = () => {
    const newId = generateId()
    setChatId(newId)
    // Clear other chat-related state that persists due to Next.js 16 component caching
    setInput('')
    setUploadedFiles([])
    setErrorModal({
      open: false,
      type: 'general',
      message: ''
    })
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [input, setInput] = useState('')
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

  // Locally-maintained streaming flag exposed through ChatContext so
  // programmatic dispatch sites (e.g. Related-question buttons in
  // spec-block) can throttle clicks. Held in a ref so closures
  // captured by @json-render/react's ActionProvider (which freezes
  // its `handlers` prop via useState(initialHandlers)) can still see
  // the freshest value through `.current`. See lib/contexts/chat-context.tsx.
  const isStreamingRef = useRef(false)
  const showAdaptiveModeAuthModal = useCallback(() => {
    setErrorModal({
      open: true,
      type: 'auth',
      message: ADAPTIVE_MODE_AUTH_REQUIRED_MESSAGE
    })
  }, [setErrorModal])

  const isCurrentAdaptiveModeAuthBlocked = useCallback(
    () =>
      isAdaptiveModeAuthBlocked({
        mode: getCookie('searchMode') === 'adaptive' ? 'adaptive' : 'quick',
        isGuest,
        isCloudDeployment
      }),
    [isGuest, isCloudDeployment]
  )

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
    id: chatId, // use the client-generated or provided chatId
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
            chatId: chatId,
            messageId,
            analyticsId: getDistinctId(),
            ...(isGuest ? { messages } : {}),
            message:
              trigger === 'regenerate-message' &&
              messageToRegenerate?.role === 'user'
                ? messageToRegenerate
                : trigger === 'submit-message'
                  ? lastMessage
                  : undefined,
            isNewChat:
              trigger === 'submit-message' &&
              messages.length === 1 &&
              savedMessages.length === 0
          }
        }
      }
    }),
    messages: savedMessages,
    onFinish: ({ message }) => {
      isStreamingRef.current = false
      window.dispatchEvent(new CustomEvent('chat-history-updated'))

      const summary = summarizeGenui(getTextFromParts(message.parts))
      if (summary) {
        captureClient('genui_component_shown', { chatId, ...summary })
      }
    },
    onError: error => {
      isStreamingRef.current = false
      const publicError = toPublicErrorPayload(error)

      if (publicError.type === 'rate-limit') {
        setErrorModal({
          open: true,
          type: 'rate-limit',
          message: publicError.error,
          details: getPublicRateLimitDetails(publicError)
        })
      } else if (publicError.type === 'auth') {
        setErrorModal({
          open: true,
          type: 'auth',
          message: publicError.error
        })
      } else if (publicError.type === 'forbidden') {
        setErrorModal({
          open: true,
          type: 'forbidden',
          message: publicError.error
        })
      } else {
        toast.error(publicError.error)
      }
    },
    experimental_throttle: 100,
    generateId
  })

  // Keep all request entry points reflected in isStreamingRef so downstream
  // action handlers can reliably reject overlapping sends.
  const safeSendMessage = useCallback<typeof sendMessage>(
    (...args) => {
      if (isCurrentAdaptiveModeAuthBlocked()) {
        showAdaptiveModeAuthModal()
        return Promise.resolve()
      }

      isStreamingRef.current = true
      try {
        return sendMessage(...args)
      } catch (error) {
        isStreamingRef.current = false
        throw error
      }
    },
    [sendMessage, isCurrentAdaptiveModeAuthBlocked, showAdaptiveModeAuthModal]
  )

  const safeRegenerate = useCallback(
    async (...args: Parameters<typeof regenerate>) => {
      if (isCurrentAdaptiveModeAuthBlocked()) {
        showAdaptiveModeAuthModal()
        return
      }

      isStreamingRef.current = true
      try {
        return await regenerate(...args)
      } catch (error) {
        isStreamingRef.current = false
        throw error
      }
    },
    [regenerate, isCurrentAdaptiveModeAuthBlocked, showAdaptiveModeAuthModal]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  // Convert messages array to sections array.
  // Deduplicate by message.id — @ai-sdk/react useChat can occasionally
  // surface the same assistant message twice during stream finalization,
  // which would otherwise produce React 'duplicate key' warnings in
  // chat-messages.tsx (one warning per re-render).
  const sections = useMemo<ChatSection[]>(() => {
    const result: ChatSection[] = []
    const seenIds = new Set<string>()
    let currentSection: ChatSection | null = null

    for (const message of messages) {
      if (seenIds.has(message.id)) continue
      seenIds.add(message.id)

      if (message.role === 'user') {
        if (currentSection) {
          result.push(currentSection)
        }
        currentSection = {
          id: message.id,
          userMessage: message,
          assistantMessages: []
        }
      } else if (currentSection && message.role === 'assistant') {
        currentSection.assistantMessages.push(message)
      }
    }

    if (currentSection) {
      result.push(currentSection)
    }

    return result
  }, [messages])

  // Listen for copy message shortcut
  // Uses ref to avoid re-registering listener on every messages change.
  // Uses defaultPrevented + visibility check to prevent duplicate handling
  // when multiple Chat instances are mounted (Next.js component caching).
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const handleCopyMessage = (e: Event) => {
      if (e.defaultPrevented) return
      // Only handle in the visible (active) Chat instance
      if (!scrollContainerRef.current?.offsetParent) return
      e.preventDefault()

      const assistantMessages = messagesRef.current.filter(
        m => m.role === 'assistant'
      )
      const lastAssistant = assistantMessages[assistantMessages.length - 1]
      if (!lastAssistant) {
        toast.info('No assistant message to copy')
        return
      }
      const text =
        lastAssistant.parts
          ?.filter(
            (p): p is { type: 'text'; text: string } => p.type === 'text'
          )
          .map(p => p.text)
          .join('\n') ?? ''

      if (text) {
        navigator.clipboard.writeText(stripSpecBlocks(text)).then(
          () => toast.success('Message copied to clipboard'),
          () => toast.error('Failed to copy message')
        )
      }
    }

    window.addEventListener(SHORTCUT_EVENTS.copyMessage, handleCopyMessage)
    return () =>
      window.removeEventListener(SHORTCUT_EVENTS.copyMessage, handleCopyMessage)
  }, [])

  // Dispatch custom event when messages change
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('messages-changed', {
        detail: { hasMessages: messages.length > 0 }
      })
    )
  }, [messages.length])

  // Detect if scroll container is at the bottom
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const updateIsAtBottom = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const threshold = 50 // threshold in pixels
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < threshold)
    }

    const handleScroll = () => {
      updateIsAtBottom()
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    const frame = requestAnimationFrame(updateIsAtBottom)

    return () => {
      cancelAnimationFrame(frame)
      container.removeEventListener('scroll', handleScroll)
    }
  }, [messages.length])

  // Check scroll position when messages change (during generation)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const frame = requestAnimationFrame(() => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const threshold = 50
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < threshold)
    })

    return () => cancelAnimationFrame(frame)
  }, [messages])

  // Scroll to the section when a new user message is sent
  useEffect(() => {
    // Only scroll if this chat is currently visible in the URL
    const isCurrentChat =
      window.location.pathname === `/search/${chatId}` ||
      (window.location.pathname === '/' && sections.length > 0)

    if (isCurrentChat && sections.length > 0) {
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
  }, [sections, messages, chatId])

  const handleUpdateAndReloadMessage = async (
    editedMessageId: string,
    newContentText: string
  ) => {
    if (!chatId) {
      toast.error('Chat ID is missing.')
      console.error('handleUpdateAndReloadMessage: chatId is undefined.')
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
        const original = updatedMessages[messageIndex]
        // Only replace the text part — keep pasted-content / URL / file parts
        // so editing the instruction doesn't drop the structured context.
        const oldParts = (original.parts ?? []) as any[]
        const newParts = oldParts.some((p: any) => p.type === 'text')
          ? oldParts.map((p: any) =>
              p.type === 'text' ? { type: 'text', text: newContentText } : p
            )
          : [...oldParts, { type: 'text', text: newContentText }]
        updatedMessages[messageIndex] = {
          ...original,
          parts: newParts
        }

        return updatedMessages
      })

      // Regenerate from this message
      await safeRegenerate({ messageId: editedMessageId })
    } catch (error) {
      console.error('Error during message edit and reload process:', error)
      toast.error(toPublicErrorPayload(error).error)
    }
  }

  const handleReloadFrom = async (reloadFromFollowerMessageId: string) => {
    if (!chatId) {
      toast.error('Chat ID is missing for reload.')
      return
    }

    try {
      // Use the SDK's regenerate function with the specific messageId
      await safeRegenerate({ messageId: reloadFromFollowerMessageId })
    } catch (error) {
      console.error(
        `Error during reload from message ${reloadFromFollowerMessageId}:`,
        error
      )
      toast.error(toPublicErrorPayload(error).error)
    }
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

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

      safeSendMessage({ role: 'user', parts })
      setInput('')
      setUploadedFiles([])

      // Push URL state immediately after sending message (for new chats)
      // Check if we're on the root path (new chat)
      if (!isGuest && window.location.pathname === '/') {
        window.history.pushState({}, '', `/search/${chatId}`)
      }
    }
  }

  const { isDragging, handleDragOver, handleDragLeave, handleDrop } =
    useFileDropzone({
      uploadedFiles,
      setUploadedFiles,
      chatId: chatId
    })
  const guestDragHandlers = {
    isDragging: false,
    handleDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
    },
    handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
    },
    handleDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
    }
  }
  const dragHandlers = isGuest
    ? guestDragHandlers
    : { isDragging, handleDragOver, handleDragLeave, handleDrop }

  return (
    <ChatProvider sendMessage={safeSendMessage} isStreamingRef={isStreamingRef}>
      <div
        className={cn(
          'relative flex h-full min-w-0 flex-1 flex-col',
          messages.length === 0 ? 'items-center justify-center' : ''
        )}
        data-testid="full-chat"
        onDragOver={dragHandlers.handleDragOver}
        onDragLeave={dragHandlers.handleDragLeave}
        onDrop={dragHandlers.handleDrop}
      >
        <ChatMessages
          sections={sections}
          status={status}
          chatId={chatId}
          isGuest={isGuest}
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
          chatId={chatId}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={onSubmit}
          status={status}
          messages={messages}
          setMessages={setMessages}
          stop={stop}
          query={query}
          append={(message: any) => {
            safeSendMessage(message)
          }}
          showScrollToBottomButton={!isAtBottom}
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
          scrollContainerRef={scrollContainerRef}
          onNewChat={handleNewChat}
          isGuest={isGuest}
          isCloudDeployment={isCloudDeployment}
          onAdaptiveModeAuthRequired={showAdaptiveModeAuthModal}
          modelSelectorData={modelSelectorData}
          sections={sections}
        />
        <DragOverlay visible={dragHandlers.isDragging} />
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
                      safeSendMessage(lastUserMessage)
                    }
                  }
                }
              : undefined
          }
          onAuthClose={() => {
            // Clear messages and navigate to root
            setMessages([])
            router.push('/')
          }}
        />
      </div>
    </ChatProvider>
  )
}
