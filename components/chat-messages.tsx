'use client'

import { useEffect, useRef, useState } from 'react'

import { UseChatHelpers } from '@ai-sdk/react'

import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import { AnimatedLogo } from './ui/animated-logo'
import { ChatError } from './chat-error'
import { RenderMessage } from './render-message'

// Import section structure interface
interface ChatSection {
  id: string
  userMessage: UIMessage
  assistantMessages: UIMessage[]
}

interface ChatMessagesProps {
  sections: ChatSection[] // Changed from messages to sections
  onQuerySelect: (query: string) => void
  status: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  chatId?: string
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  /** Ref for the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (messageId: string) => Promise<void | string | null | undefined>
  error?: Error | string | null | undefined
}

export function ChatMessages({
  sections,
  onQuerySelect,
  status,
  chatId,
  addToolResult,
  scrollContainerRef,
  onUpdateMessage,
  reload,
  error
}: ChatMessagesProps) {
  // Track user-modified states (when user explicitly opens/closes)
  const [userModifiedStates, setUserModifiedStates] = useState<
    Record<string, boolean>
  >({})
  // Cache tool counts for performance optimization
  const toolCountCacheRef = useRef<Map<string, number>>(new Map())
  const isLoading = status === 'submitted' || status === 'streaming'
  const [offsetHeight, setOffsetHeight] = useState(160) // Dynamic offset for minHeight calculation

  // Tool types definition - moved outside function for performance
  const toolTypes = [
    'tool-search',
    'tool-fetch',
    'tool-askQuestion',
    'tool-relatedQuestions'
  ]

  // Clear cache during streaming to ensure accurate tool counts
  useEffect(() => {
    if (isLoading) {
      // Clear cache for all messages during streaming
      toolCountCacheRef.current.clear()
    }
  }, [isLoading])

  // Calculate the offset height dynamically based on viewport and UI elements
  useEffect(() => {
    const calculateOffset = () => {
      // Account for:
      // - Header/navigation (estimated)
      // - ChatPanel (input area)
      // - Additional padding and margins
      const headerHeight = 56 // pt-14 padding top
      const chatPanelEstimatedHeight = 120 // ChatPanel with input area
      const additionalPadding = 32 // Safety margin for better visibility

      const totalOffset =
        headerHeight + chatPanelEstimatedHeight + additionalPadding
      setOffsetHeight(totalOffset)
    }

    calculateOffset()
    window.addEventListener('resize', calculateOffset)
    return () => window.removeEventListener('resize', calculateOffset)
  }, [])

  if (!sections.length) return null

  // Check if loading indicator should be shown
  const showLoading = status === 'submitted' || status === 'streaming'

  // Helper function to get tool count with caching
  const getToolCount = (message?: UIMessage): number => {
    if (!message || !message.id) return 0

    // During streaming, always recalculate
    if (isLoading) {
      const count =
        message.parts?.filter(part => toolTypes.includes(part.type)).length || 0
      return count
    }

    // Check cache first when not streaming
    const cached = toolCountCacheRef.current.get(message.id)
    if (cached !== undefined) {
      return cached
    }

    // Calculate and cache
    const count =
      message.parts?.filter(part => toolTypes.includes(part.type)).length || 0
    toolCountCacheRef.current.set(message.id, count)
    return count
  }

  const getIsOpen = (
    id: string,
    partType?: string,
    hasNextPart?: boolean,
    message?: UIMessage
  ) => {
    // If user has explicitly modified this state, use that
    if (userModifiedStates.hasOwnProperty(id)) {
      return userModifiedStates[id]
    }

    // For tool types, check if there are multiple tools
    if (partType && toolTypes.includes(partType)) {
      const toolCount = getToolCount(message)
      // If multiple tools exist, default to closed
      if (toolCount > 1) {
        return false
      }
      // Single tool: check if there's a next part
      // If there's subsequent content, default to closed
      return !hasNextPart
    }

    // For tool-invocations, default to open
    if (partType === 'tool-invocation') {
      return true
    }

    // For reasoning, auto-collapse if there's a next part in the same message
    if (partType === 'reasoning') {
      return !hasNextPart
    }

    // For other types (like text), default to open
    return true
  }

  const handleOpenChange = (id: string, open: boolean) => {
    setUserModifiedStates(prev => ({
      ...prev,
      [id]: open
    }))
  }

  return (
    <div
      id="scroll-container"
      ref={scrollContainerRef}
      role="list"
      aria-roledescription="chat messages"
      className={cn(
        'relative size-full pt-14',
        sections.length > 0 ? 'flex-1 overflow-y-auto' : ''
      )}
    >
      <div className="relative mx-auto w-full max-w-3xl px-4">
        {sections.map((section, sectionIndex) => (
          <div
            key={section.id}
            id={`section-${section.id}`}
            className="chat-section mb-8"
            style={
              sectionIndex === sections.length - 1
                ? { minHeight: `calc(100dvh - ${offsetHeight}px)` }
                : {}
            }
          >
            {/* User message */}
            <div className="flex flex-col gap-4 mb-4">
              <RenderMessage
                message={section.userMessage}
                messageId={section.userMessage.id}
                getIsOpen={(id, partType, hasNextPart) =>
                  getIsOpen(id, partType, hasNextPart, section.userMessage)
                }
                onOpenChange={handleOpenChange}
                onQuerySelect={onQuerySelect}
                chatId={chatId}
                status={status}
                addToolResult={addToolResult}
                onUpdateMessage={onUpdateMessage}
                reload={reload}
              />
            </div>

            {/* Assistant messages */}
            {section.assistantMessages.map((assistantMessage, messageIndex) => {
              // Check if this is the latest assistant message in the latest section
              const isLatestMessage =
                sectionIndex === sections.length - 1 &&
                messageIndex === section.assistantMessages.length - 1

              return (
                <div key={assistantMessage.id} className="flex flex-col gap-4">
                  <RenderMessage
                    message={assistantMessage}
                    messageId={assistantMessage.id}
                    getIsOpen={(id, partType, hasNextPart) =>
                      getIsOpen(id, partType, hasNextPart, assistantMessage)
                    }
                    onOpenChange={handleOpenChange}
                    onQuerySelect={onQuerySelect}
                    chatId={chatId}
                    status={status}
                    addToolResult={addToolResult}
                    onUpdateMessage={onUpdateMessage}
                    reload={reload}
                    isLatestMessage={isLatestMessage}
                  />
                </div>
              )
            })}
            {/* Show loading after assistant messages */}
            {showLoading && sectionIndex === sections.length - 1 && (
              <div className="flex justify-start py-4">
                <AnimatedLogo className="h-10 w-10" />
              </div>
            )}
            {sectionIndex === sections.length - 1 && (
              <ChatError error={error} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
