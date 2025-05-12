'use client'

import { cn } from '@/lib/utils'
import { ChatRequestOptions, JSONValue, UIMessage } from 'ai'
import { useEffect, useMemo, useState } from 'react'
import { RenderMessage } from './render-message'
import { ToolSection } from './tool-section'
import { Spinner } from './ui/spinner'

interface ChatMessagesProps {
  messages: UIMessage[]
  data: JSONValue[] | undefined
  onQuerySelect: (query: string) => void
  isLoading: boolean
  chatId?: string
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  /** Ref for anchoring auto-scroll position */
  anchorRef: React.RefObject<HTMLDivElement>
  /** Ref for the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (
    messageId: string,
    options?: ChatRequestOptions
  ) => Promise<string | null | undefined>
  /** Whether auto-scroll is enabled (used by the button, now removed) */
  // isAutoScroll?: boolean  // No longer needed
  /** Function to enable auto-scroll (used by the button, now removed) */
  // enableAutoScroll?: () => void // No longer needed
}

export function ChatMessages({
  messages,
  data,
  onQuerySelect,
  isLoading,
  chatId,
  addToolResult,
  anchorRef,
  scrollContainerRef,
  onUpdateMessage,
  reload
}: // isAutoScroll, // No longer needed
// enableAutoScroll // No longer needed
ChatMessagesProps) {
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})
  const manualToolCallId = 'manual-tool-call'

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'user') {
      setOpenStates({ [manualToolCallId]: true })
    }
  }, [messages])

  // get last tool data for manual tool call
  const lastToolData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return null

    const lastItem = data[data.length - 1] as {
      type: 'tool_call'
      data: {
        toolCallId: string
        state: 'call' | 'result'
        toolName: string
        args: string
      }
    }

    if (lastItem.type !== 'tool_call') return null

    const toolData = lastItem.data
    return {
      state: 'call' as const,
      toolCallId: toolData.toolCallId,
      toolName: toolData.toolName,
      args: toolData.args ? JSON.parse(toolData.args) : undefined
    }
  }, [data])

  if (!messages.length) return null

  const lastUserIndex =
    messages.length -
    1 -
    [...messages].reverse().findIndex(msg => msg.role === 'user')

  const showLoading = isLoading && messages[messages.length - 1].role === 'user'

  const getIsOpen = (id: string) => {
    if (id.includes('call')) {
      return openStates[id] ?? true
    }
    const baseId = id.endsWith('-related') ? id.slice(0, -8) : id
    const index = messages.findIndex(msg => msg.id === baseId)
    return openStates[id] ?? index >= lastUserIndex
  }

  const handleOpenChange = (id: string, open: boolean) => {
    setOpenStates(prev => ({
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
        messages.length > 0 ? 'flex-1 overflow-y-auto' : ''
      )}
      // style={{ contain: 'strict' }}
    >
      <div className="relative mx-auto w-full max-w-3xl px-4">
        {messages.map(message => (
          <div key={message.id} className="mb-4 flex flex-col gap-4">
            <RenderMessage
              message={message}
              messageId={message.id}
              getIsOpen={getIsOpen}
              onOpenChange={handleOpenChange}
              onQuerySelect={onQuerySelect}
              chatId={chatId}
              addToolResult={addToolResult}
              onUpdateMessage={onUpdateMessage}
              reload={reload}
            />
          </div>
        ))}
        {showLoading &&
          (lastToolData ? (
            <ToolSection
              key={manualToolCallId}
              tool={lastToolData}
              isOpen={getIsOpen(manualToolCallId)}
              onOpenChange={open => handleOpenChange(manualToolCallId, open)}
              addToolResult={addToolResult}
            />
          ) : (
            <Spinner />
          ))}
        <div ref={anchorRef} />
      </div>
      {/* Scroll to bottom button has been removed from here */}
    </div>
  )
}
