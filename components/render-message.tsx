import { Message } from 'ai'
import { UserMessage } from './user-message'
import { ToolSection } from './tool-section'
import { AnswerSection } from './answer-section'

interface RenderMessageProps {
  message: Message
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function RenderMessage({
  message,
  isOpen,
  onOpenChange
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
            isOpen={isOpen}
            onOpenChange={onOpenChange}
          />
        ))}
      </>
    )
  }

  return (
    <AnswerSection
      content={message.content}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  )
}
