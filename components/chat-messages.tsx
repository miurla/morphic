import { ChatMessage } from '@/lib/db'
import { useEffect, useRef } from 'react'
import { RenderMessage } from './render-message'
import { Spinner } from './ui/spinner'

interface ChatMessagesProps {
  messages: ChatMessage[]
  isLoading: boolean
  submitQueryFromOutline: (itemText: string, threadId: string) => Promise<void>
}

export function ChatMessages({
  messages,
  isLoading,
  submitQueryFromOutline
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, isLoading])

  if (!messages.length && !isLoading) return null

  return (
    <div className="relative mx-auto px-4 w-full">
      {messages.map(message => (
        <div key={message.id} className="mb-4 flex flex-col gap-4">
          <RenderMessage
            message={message}
            submitQueryFromOutline={submitQueryFromOutline}
          />
        </div>
      ))}
      {isLoading && messages[messages.length - 1]?.role === 'user' && (
        <div className="flex justify-center items-center p-4">
          <Spinner />
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
