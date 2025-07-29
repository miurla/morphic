import { UseChatHelpers } from '@ai-sdk/react'

import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'

import { AnswerSection } from './answer-section'
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
        // Check if this is the last text part in the array
        const textParts =
          message.parts?.filter((part: any) => part.type === 'text') || []
        const isLastTextPart =
          part.type === 'text' &&
          textParts.indexOf(part) === textParts.length - 1

        // Check if there's a next part in this message
        const hasNextPart = message.parts && index < message.parts.length - 1

        switch (part.type) {
          case 'tool-search':
          case 'tool-retrieve':
          case 'tool-videoSearch':
          case 'tool-askQuestion':
          case 'tool-relatedQuestions':
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
                part={part as any}
              />
            )
          case 'text':
            // Only show actions if this is the last part and it's a text part
            return (
              <AnswerSection
                key={`${messageId}-text-${index}`}
                content={part.text}
                isOpen={getIsOpen(messageId, part.type, hasNextPart)}
                onOpenChange={open => onOpenChange(messageId, open)}
                chatId={chatId}
                showActions={isLastTextPart}
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
          // Add other part types as needed
          default:
            return null
        }
      })}
    </>
  )
}
