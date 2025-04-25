import { ChatMessage } from '@/lib/db'
import { AnswerSection } from './answer-section'
import { UserMessage } from './user-message'

interface RenderMessageProps {
  message: ChatMessage
  submitQueryFromOutline: (itemText: string, threadId: string) => Promise<void>
}

export function RenderMessage({
  message,
  submitQueryFromOutline
}: RenderMessageProps) {
  if (message.role === 'user') {
    return <UserMessage message={message.content} />
  }

  if (message.role === 'assistant') {
    if (!message.thread_id) {
      console.warn(
        '[RenderMessage] Assistant message missing thread_id:',
        message.id
      )
      return (
        <AnswerSection
          message={message}
          isOpen={true}
          onOpenChange={() => {}}
          showActions={false}
          onOutlineItemClick={() => {
            console.error(
              'Outline click attempted on message with missing thread_id'
            )
          }}
        />
      )
    }

    return (
      <AnswerSection
        message={message}
        isOpen={true}
        onOpenChange={() => {}}
        showActions={true}
        onOutlineItemClick={submitQueryFromOutline}
      />
    )
  }

  return null
}
