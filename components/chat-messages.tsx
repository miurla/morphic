import { Message } from 'ai'
import RelatedQuestions from './related-questions'
import { RenderMessage } from './render-message'
import { Spinner } from './ui/spinner'
import { useState, useEffect } from 'react'

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
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'user') {
      setOpenStates({})
    }
  }, [messages])

  if (!messages.length) return null

  const lastUserIndex =
    messages.length -
    1 -
    [...messages].reverse().findIndex(msg => msg.role === 'user')
  const showSpinner = isLoading && messages[messages.length - 1].role === 'user'

  return (
    <div className="relative mx-auto px-4 w-full">
      {messages.map((message, index) => (
        <div key={message.id} className="mb-4 flex flex-col gap-4">
          <RenderMessage
            message={message}
            isOpen={openStates[message.id] ?? index >= lastUserIndex}
            onOpenChange={(open: boolean) => {
              setOpenStates(prev => ({
                ...prev,
                [message.id]: open
              }))
            }}
          />
          {!message.toolInvocations && message.annotations && (
            <RelatedQuestions
              annotations={message.annotations}
              onQuerySelect={onQuerySelect}
              isOpen={
                openStates[`${message.id}-related`] ?? index >= lastUserIndex
              }
              onOpenChange={(open: boolean) => {
                setOpenStates(prev => ({
                  ...prev,
                  [`${message.id}-related`]: open
                }))
              }}
            />
          )}
        </div>
      ))}
      {showSpinner && <Spinner />}
    </div>
  )
}
