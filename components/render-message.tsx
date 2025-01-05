import { Message } from 'ai'
import { UserMessage } from './user-message'
import { ToolSection } from './tool-section'
import { AnswerSection } from './answer-section'
import RelatedQuestions from './related-questions'

interface RenderMessageProps {
  message: Message
  messageId: string
  getIsOpen: (id: string) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
}

export function RenderMessage({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  onQuerySelect
}: RenderMessageProps) {
  if (message.role === 'user') {
    return <UserMessage message={message.content} />
  }

  if (message.toolInvocations?.length) {
    return (
      <>
        {message.toolInvocations.map(tool => (
          <ToolSection
            key={tool.toolCallId}
            tool={tool}
            isOpen={getIsOpen(messageId)}
            onOpenChange={open => onOpenChange(messageId, open)}
          />
        ))}
      </>
    )
  }

  return (
    <>
      <AnswerSection
        content={message.content}
        isOpen={getIsOpen(messageId)}
        onOpenChange={open => onOpenChange(messageId, open)}
      />
      {!message.toolInvocations && message.annotations && (
        <RelatedQuestions
          annotations={message.annotations}
          onQuerySelect={onQuerySelect}
          isOpen={getIsOpen(`${messageId}-related`)}
          onOpenChange={open => onOpenChange(`${messageId}-related`, open)}
        />
      )}
    </>
  )
}
