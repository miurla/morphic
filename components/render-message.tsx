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

  return (
    <>
      {message.parts?.map((part: any, index: number) => {
        // Check if there's a next part in this message
        const hasNextPart = message.parts && index < message.parts.length - 1

        switch (part.type) {
          case 'tool-search':
          case 'tool-fetch':
          case 'tool-askQuestion':
          case 'tool-todoWrite':
          case 'tool-todoRead':
            return (
              <ToolSection
                key={`${messageId}-tool-${index}`}
                tool={part as any}
                isOpen={getIsOpen(part.toolCallId, part.type, hasNextPart)}
                onOpenChange={open => onOpenChange(part.toolCallId, open)}
                addToolResult={addToolResult}
                status={status}
                onQuerySelect={onQuerySelect}
              />
            )
          case 'dynamic-tool':
            return (
              <DynamicToolDisplay
                key={`${messageId}-dynamic-tool-${index}`}
                part={part as DynamicToolPart}
              />
            )
          case 'text':
            // Find if this is the last text part in this message
            const remainingParts = message.parts?.slice(index + 1) || []
            const hasMoreTextParts = remainingParts.some(p => p.type === 'text')
            const isLastTextPart = !hasMoreTextParts

            // Check if streaming is complete
            const isStreamingComplete =
              status !== 'streaming' && status !== 'submitted'

            // Show actions only on the last text part of each message
            // For the latest message, also check if streaming is complete
            const shouldShowActions =
              isLastTextPart && (isLatestMessage ? isStreamingComplete : true)
            return (
              <AnswerSection
                key={`${messageId}-text-${index}`}
                content={part.text}
                isOpen={getIsOpen(messageId, part.type, hasNextPart)}
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
          case 'reasoning':
            return (
              <ReasoningSection
                key={`${messageId}-reasoning-${index}`}
                content={{
                  reasoning: part.text,
                  isDone: index !== (message.parts?.length ?? 0) - 1
                }}
                isOpen={getIsOpen(
                  `${messageId}-reasoning-${index}`,
                  part.type,
                  hasNextPart
                )}
                onOpenChange={open =>
                  onOpenChange(`${messageId}-reasoning-${index}`, open)
                }
              />
            )
          case 'data-relatedQuestions':
            return (
              <DataSection
                key={`${messageId}-${part.type}-${index}`}
                part={part}
                onQuerySelect={onQuerySelect}
              />
            )
          default:
            return null
        }
      })}
    </>
  )
}
