import { Message } from 'ai'
import RelatedQuestions from './related-questions'
import { RenderMessage } from './render-message'
import { Spinner } from './ui/spinner'

interface ChatMessagesProps {
  messages: Message[]
  onQuerySelect: (query: string) => void
  isLoading: boolean
}

export function ChatMessages({
  messages,
  onQuerySelect,
  isLoading
}: ChatMessagesProps) {
  if (!messages.length) {
    return null
  }

  const showSpinner = isLoading && messages[messages.length - 1].role === 'user'

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
      {showSpinner && <Spinner />}
    </div>
  )
}
