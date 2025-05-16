import { Message } from 'ai'
import { AnswerSection } from './answer-section'
import { ReasoningSection } from './reasoning-section'
import { ToolSection } from './tool-section'
import { UserMessage } from './user-message'

interface RenderMessageProps {
  message: Message
  messageId: string
  getIsOpen: (id: string) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
  chatId?: string
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
  addToolResult,
  onUpdateMessage,
  reload
}: RenderMessageProps) {
  if (message.role === 'user') {
    return (
      <UserMessage
        message={message}
        messageId={messageId}
        onUpdateMessage={onUpdateMessage}
      />
    )
  }

  // New way: Use parts instead of toolInvocations
  return (
    <>
      {message.parts?.map((part, index) => {
        // Check if this is the last part in the array
        const isLastPart = index === (message.parts?.length ?? 0) - 1

        switch (part.type) {
          case 'tool-invocation':
            return (
              <ToolSection
                key={`${messageId}-tool-${index}`}
                tool={part.toolInvocation}
                isOpen={getIsOpen(part.toolInvocation.toolCallId)}
                onOpenChange={open =>
                  onOpenChange(part.toolInvocation.toolCallId, open)
                }
                addToolResult={addToolResult}
              />
            )
          case 'text':
            // Only show actions if this is the last part and it's a text part
            return (
              <AnswerSection
                key={`${messageId}-text-${index}`}
                content={part.text}
                isOpen={getIsOpen(messageId)}
                onOpenChange={open => onOpenChange(messageId, open)}
                chatId={chatId}
                showActions={isLastPart}
                messageId={messageId}
                reload={reload}
              />
            )
          case 'reasoning':
            return (
              <ReasoningSection
                key={`${messageId}-reasoning-${index}`}
                content={{
                  reasoning: part.reasoning,
                  isDone: index !== (message.parts?.length ?? 0) - 1
                }}
                isOpen={getIsOpen(messageId)}
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
