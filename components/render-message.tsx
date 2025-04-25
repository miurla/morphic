import { ChatMessage } from '@/lib/db'
import { AnswerSection } from './answer-section'
import { UserMessage } from './user-message'

interface RenderMessageProps {
  message: ChatMessage
}

export function RenderMessage({ message }: RenderMessageProps) {
  if (message.role === 'user') {
    return <UserMessage message={message.content} />
  }

  if (message.role === 'assistant') {
    return (
      <AnswerSection
        content={message.content}
        isOpen={true}
        onOpenChange={() => {}}
        showActions={false}
      />
    )
  }

  return null
}
