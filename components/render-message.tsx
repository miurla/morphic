import { Message } from 'ai'
import { AnswerSection } from './answer-section'
import { ReasoningAnswerSection } from './reasoning-answer-section'
import RelatedQuestions from './related-questions'
import { ToolSection } from './tool-section'
import { UserMessage } from './user-message'

interface RenderMessageProps {
  message: Message
  messageId: string
  getIsOpen: (id: string) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
  chatId?: string
}

export function RenderMessage({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  onQuerySelect,
  chatId
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
      {message.reasoning ? (
        <ReasoningAnswerSection
          content={{
            reasoning: message.reasoning,
            answer: message.content
          }}
          isOpen={getIsOpen(messageId)}
          onOpenChange={open => onOpenChange(messageId, open)}
          chatId={chatId}
        />
      ) : (
        <AnswerSection
          content={message.content}
          isOpen={getIsOpen(messageId)}
          onOpenChange={open => onOpenChange(messageId, open)}
          chatId={chatId}
        />
      )}
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
