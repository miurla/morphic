import { Message } from 'ai'
import { UserMessage } from './user-message'
import { BotMessage } from './message'
import RelatedQuestions from './related-questions'

interface ChatMessagesProps {
  messages: Message[]
  onQuerySelect: (query: string) => void
}

export function ChatMessages({ messages, onQuerySelect }: ChatMessagesProps) {
  if (!messages.length) {
    return null
  }

  return (
    <div className="relative mx-auto px-4 w-full">
      {messages.map(message => (
        <div key={message.id} className="mb-4">
          {message.role === 'user' ? (
            <UserMessage message={message.content} />
          ) : (
            <BotMessage message={message.content} />
          )}
          {!message.toolInvocations && message.annotations && (
            <RelatedQuestions
              annotations={message.annotations}
              onQuerySelect={onQuerySelect}
            />
          )}
        </div>
      ))}
    </div>
  )
}
