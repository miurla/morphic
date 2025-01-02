import { Message } from 'ai'
import RelatedQuestions from './related-questions'
import { RenderMessage } from './render-message'

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
          <RenderMessage message={message} />
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
