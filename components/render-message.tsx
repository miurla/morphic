import { UseChatHelpers } from '@ai-sdk/react'

import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import type { DynamicToolPart } from '@/lib/types/dynamic-tools'

import { AnswerSection } from './answer-section'
import { DynamicToolDisplay } from './dynamic-tool-display'
import { ReasoningSection } from './reasoning-section'
import { RelatedQuestions } from './related-questions'
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
  reload
}: RenderMessageProps) {
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
            // Show actions if:
            // 1. This is the last part and streaming is complete
            // 2. Next part is data-relatedQuestions
            const nextMessagePart = message.parts?.[index + 1]
            const isStreamingComplete =
              status !== 'streaming' && status !== 'submitted'
            const isLastPart = !hasNextPart
            const shouldShowActions =
              (isLastPart && isStreamingComplete) || // Last part and streaming done
              nextMessagePart?.type === 'data-relatedQuestions' // Next part is related questions
            return (
              <AnswerSection
                key={`${messageId}-text-${index}`}
                content={part.text}
                isOpen={getIsOpen(messageId, part.type, hasNextPart)}
                onOpenChange={open => onOpenChange(messageId, open)}
                chatId={chatId}
                showActions={shouldShowActions}
                messageId={messageId}
                reload={reload}
                status={status}
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
                isOpen={getIsOpen(messageId, part.type, hasNextPart)}
                onOpenChange={open => onOpenChange(messageId, open)}
              />
            )
          case 'data-relatedQuestions':
            return (
              <RelatedQuestions
                key={`${messageId}-related-${index}`}
                data={part.data}
                onQuerySelect={onQuerySelect}
              />
            )
          // Add other part types as needed
          default:
            return null
        }
      })}
    </>
  )
}
