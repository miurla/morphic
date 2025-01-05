import { Message } from 'ai'
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

  const getIsOpen = (id: string) => {
    const index = messages.findIndex(msg => msg.id === id.split('-')[0])
    return openStates[id] ?? index >= lastUserIndex
  }

  const handleOpenChange = (id: string, open: boolean) => {
    setOpenStates(prev => ({
      ...prev,
      [id]: open
    }))
  }

  return (
    <div className="relative mx-auto px-4 w-full">
      {messages.map(message => (
        <div key={message.id} className="mb-4 flex flex-col gap-4">
          <RenderMessage
            message={message}
            messageId={message.id}
            getIsOpen={getIsOpen}
            onOpenChange={handleOpenChange}
            onQuerySelect={onQuerySelect}
          />
        </div>
      ))}
      {showSpinner && <Spinner />}
    </div>
  )
}
