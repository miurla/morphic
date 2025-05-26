'use client'

import { cn } from '@/lib/utils'
import { UseChatHelpers } from '@ai-sdk/react'
import { UIMessage } from 'ai'
import { useState } from 'react'
import { DefaultSkeleton } from './default-skeleton'
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
  status: UseChatHelpers['status']
  chatId?: string
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  /** Ref for the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (messageId: string) => Promise<void | string | null | undefined>
}

export function ChatMessages({
  sections,
  onQuerySelect,
  status,
  chatId,
  addToolResult,
  scrollContainerRef,
  onUpdateMessage,
  reload
}: ChatMessagesProps) {
  // Track user-modified states (when user explicitly opens/closes)
  const [userModifiedStates, setUserModifiedStates] = useState<
    Record<string, boolean>
  >({})
  const isLoading = status === 'submitted' || status === 'streaming'

  if (!sections.length) return null

  // Check if loading indicator should be shown
  const showLoading =
    isLoading &&
    sections.length > 0 &&
    sections[sections.length - 1].assistantMessages.length === 0

  const getIsOpen = (id: string, partType?: string, hasNextPart?: boolean) => {
    // If user has explicitly modified this state, use that
    if (userModifiedStates.hasOwnProperty(id)) {
      return userModifiedStates[id]
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
                ? { minHeight: 'calc(-228px + 100dvh)' }
                : {}
            }
          >
            {/* User message */}
            <div className="flex flex-col gap-4 mb-4">
              <RenderMessage
                message={section.userMessage}
                messageId={section.userMessage.id}
                getIsOpen={getIsOpen}
                onOpenChange={handleOpenChange}
                onQuerySelect={onQuerySelect}
                chatId={chatId}
                status={status}
                addToolResult={addToolResult}
                onUpdateMessage={onUpdateMessage}
                reload={reload}
                sectionIndex={sectionIndex}
              />
              {showLoading && <DefaultSkeleton />}
            </div>

            {/* Assistant messages */}
            {section.assistantMessages.map(assistantMessage => (
              <div key={assistantMessage.id} className="flex flex-col gap-4">
                <RenderMessage
                  message={assistantMessage}
                  messageId={assistantMessage.id}
                  getIsOpen={getIsOpen}
                  onOpenChange={handleOpenChange}
                  onQuerySelect={onQuerySelect}
                  chatId={chatId}
                  status={status}
                  addToolResult={addToolResult}
                  onUpdateMessage={onUpdateMessage}
                  reload={reload}
                  sectionIndex={sectionIndex}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
