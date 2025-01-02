import { Message } from 'ai'

interface ChatMessagesProps {
  messages: Message[]
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto">
      {messages.map(message => (
        <div key={message.id} className="w-full py-2">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.content}
        </div>
      ))}
    </div>
  )
}
