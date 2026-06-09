import { UseChatHelpers } from '@ai-sdk/react'

import type { SearchResultItem } from '@/lib/types'
import type {
  UIDataTypes,
  UIMessage,
  UIMessageMetadata,
  UITools
} from '@/lib/types/ai'
import type { DynamicToolPart } from '@/lib/types/dynamic-tools'

import { AnswerSection } from './answer-section'
import { DynamicToolDisplay } from './dynamic-tool-display'
import ResearchProcessSection from './research-process-section'
import { UserFileSection } from './user-file-section'
import { UserTextSection } from './user-text-section'

interface RenderMessageProps {
  message: UIMessage
  messageId: string
  getIsOpen: (id: string, partType?: string, hasNextPart?: boolean) => boolean
  onOpenChange: (id: string, open: boolean) => void
  chatId?: string
  isGuest?: boolean
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (messageId: string) => Promise<void | string | null | undefined>
  isLatestMessage?: boolean
  citationMaps?: Record<string, Record<number, SearchResultItem>>
}

export function RenderMessage({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  chatId,
  isGuest = false,
  status,
  addToolResult,
  onUpdateMessage,
  reload,
  isLatestMessage = false,
  citationMaps = {}
}: RenderMessageProps) {
  const isNonEmptyTextPart = (part: any) =>
    part?.type === 'text' &&
    typeof part.text === 'string' &&
    part.text.trim().length > 0

  // Use provided citation maps (from all messages)
  if (message.role === 'user') {
    const parts = (message.parts ?? []) as any[]
    const textPart = parts.find((part: any) => part.type === 'text')
    const files = parts.filter((part: any) => part.type === 'file')
    const pastedTexts = parts
      .filter((part: any) => part.type === 'data-pastedContent')
      .map((part: any) => part.data?.text ?? '')
    const urls = parts
      .filter((part: any) => part.type === 'data-sourceUrl')
      .map((part: any) => part.data?.url ?? '')
    return (
      <>
        {files.map((part: any, index: number) => (
          <UserFileSection
            key={`${messageId}-user-file-${index}`}
            file={{
              name: part.filename || 'Unknown file',
              url: part.url,
              contentType: part.mediaType
            }}
          />
        ))}
        {(textPart || pastedTexts.length > 0 || urls.length > 0) && (
          <UserTextSection
            content={textPart?.text ?? ''}
            pastedTexts={pastedTexts}
            urls={urls}
            messageId={messageId}
            onUpdateMessage={onUpdateMessage}
          />
        )}
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
        status={status}
        addToolResult={addToolResult}
      />
    )
    buffer = []
  }

  message.parts?.forEach((part: any, index: number) => {
    if (part.type === 'text') {
      // Ignore empty text chunks (some providers emit them before reasoning/tool parts).
      if (!isNonEmptyTextPart(part)) {
        return
      }

      // Check if there's buffered content before this text part
      const hasBufferedContent = buffer.length > 0

      // Flush accumulated non-text first, marking that text follows
      if (hasBufferedContent) {
        // Create a custom flush that passes hasSubsequentText
        if (buffer.length > 0) {
          elements.push(
            <ResearchProcessSection
              key={`${messageId}-proc-seg-${index}`}
              message={message}
              messageId={messageId}
              parts={buffer}
              getIsOpen={getIsOpen}
              onOpenChange={onOpenChange}
              status={status}
              addToolResult={addToolResult}
              hasSubsequentText={true}
            />
          )
          buffer = []
        }
      }

      const remainingParts = message.parts?.slice(index + 1) || []
      const hasMoreTextParts = remainingParts.some(isNonEmptyTextPart)
      const isLastTextPart = !hasMoreTextParts
      const isStreamingComplete =
        status !== 'streaming' && status !== 'submitted'
      const shouldShowActions =
        isLastTextPart && (isLatestMessage ? isStreamingComplete : true)

      elements.push(
        <AnswerSection
          key={`${messageId}-text-${index}`}
          content={part.text}
          isOpen={getIsOpen(
            messageId,
            part.type,
            index < (message.parts?.length ?? 0) - 1
          )}
          onOpenChange={open => onOpenChange(messageId, open)}
          chatId={chatId}
          isGuest={isGuest}
          showActions={shouldShowActions}
          messageId={messageId}
          metadata={message.metadata as UIMessageMetadata | undefined}
          reload={reload}
          status={status}
          citationMaps={citationMaps}
        />
      )
    } else if (part.type === 'reasoning' || part.type?.startsWith?.('tool-')) {
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
  // Flush tail (no subsequent text)
  flushBuffer('tail')

  return <>{elements}</>
}
