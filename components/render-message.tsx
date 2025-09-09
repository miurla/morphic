import { UseChatHelpers } from '@ai-sdk/react'

import type {
  UIDataTypes,
  UIMessage,
  UIMessageMetadata,
  UITools
} from '@/lib/types/ai'
import type { DynamicToolPart } from '@/lib/types/dynamic-tools'
import { extractCitationMaps } from '@/lib/utils/citation'

import { AnswerSection } from './answer-section'
import { DataSection } from './data-section'
import { DynamicToolDisplay } from './dynamic-tool-display'
import { ReasoningSection } from './reasoning-section'
import ResearchProcessSection from './research-process-section'
import { ToolSection } from './tool-section'
import { UserFileSection } from './user-file-section'
import { UserTextSection } from './user-text-section'

interface RenderMessageProps {
  message: UIMessage
  messageId: string
  getIsOpen: (id: string, partType?: string, hasNextPart?: boolean) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
  chatId?: string
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (messageId: string) => Promise<void | string | null | undefined>
  isLatestMessage?: boolean
}

export function RenderMessage({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  onQuerySelect,
  chatId,
  status,
  addToolResult,
  onUpdateMessage,
  reload,
  isLatestMessage = false
}: RenderMessageProps) {
  // Extract citation maps from the message's tool outputs
  const citationMaps = extractCitationMaps(message)
  if (message.role === 'user') {
    return (
      <>
        {message.parts?.map((part: any, index: number) => {
          switch (part.type) {
            case 'text':
              return (
                <UserTextSection
                  key={`${messageId}-user-text-${index}`}
                  content={part.text}
                  messageId={messageId}
                  onUpdateMessage={onUpdateMessage}
                />
              )
            case 'file':
              return (
                <UserFileSection
                  key={`${messageId}-user-file-${index}`}
                  file={{
                    name: part.filename || 'Unknown file',
                    url: part.url,
                    contentType: part.mediaType
                  }}
                />
              )
            default:
              return null
          }
        })}
      </>
    )
  }

  // New rendering: interleave text parts with grouped non-text segments
  const elements: React.ReactNode[] = []
  let buffer: any[] = []
  const flushBuffer = (keySuffix: string) => {
    if (buffer.length === 0) return
    elements.push(
      <ResearchProcessSection
        key={`${messageId}-proc-${keySuffix}`}
        message={message}
        messageId={messageId}
        parts={buffer}
        getIsOpen={getIsOpen}
        onOpenChange={onOpenChange}
        onQuerySelect={onQuerySelect}
        status={status}
        addToolResult={addToolResult}
      />
    )
    buffer = []
  }

  message.parts?.forEach((part: any, index: number) => {
    if (part.type === 'text') {
      // Flush accumulated non-text first
      flushBuffer(`seg-${index}`)

      const remainingParts = message.parts?.slice(index + 1) || []
      const hasMoreTextParts = remainingParts.some(p => p.type === 'text')
      const isLastTextPart = !hasMoreTextParts
      const isStreamingComplete = status !== 'streaming' && status !== 'submitted'
      const shouldShowActions = isLastTextPart && (isLatestMessage ? isStreamingComplete : true)

      elements.push(
        <AnswerSection
          key={`${messageId}-text-${index}`}
          content={part.text}
          isOpen={getIsOpen(messageId, part.type, index < (message.parts?.length ?? 0) - 1)}
          onOpenChange={open => onOpenChange(messageId, open)}
          chatId={chatId}
          showActions={shouldShowActions}
          messageId={messageId}
          metadata={message.metadata as UIMessageMetadata | undefined}
          reload={reload}
          status={status}
          citationMaps={citationMaps}
        />
      )
    } else if (
      part.type === 'tool-search' ||
      part.type === 'tool-fetch' ||
      part.type === 'tool-askQuestion' ||
      part.type === 'tool-todoWrite' ||
      part.type === 'tool-todoRead' ||
      part.type === 'reasoning' ||
      part.type?.startsWith?.('data-')
    ) {
      buffer.push(part)
    } else if (part.type === 'dynamic-tool') {
      flushBuffer(`seg-${index}`)
      elements.push(
        <DynamicToolDisplay
          key={`${messageId}-dynamic-tool-${index}`}
          part={part as DynamicToolPart}
        />
      )
    }
  })
  // Flush tail
  flushBuffer('tail')

  return <>{elements}</>
}
