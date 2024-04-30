import { StreamableValue, useUIState } from 'ai/rsc'
import type { AI } from '@/app/action'
import { CollapsibleMessage } from './collapsible-message'

export function ChatMessages() {
  const [messages] = useUIState<typeof AI>()

  return (
    <>
      {messages.map(
        (message: {
          id: string
          component: React.ReactNode
          isCollapsed?: StreamableValue<boolean>
          isGenerating?: StreamableValue<boolean>
        }) => (
          <CollapsibleMessage
            key={message.id}
            message={message}
            isLastMessage={message.id === messages[messages.length - 1].id}
          />
        )
      )}
    </>
  )
}
