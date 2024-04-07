'use client'

import { ChatPanel } from './chat-panel'
import { ChatMessages } from './chat-messages'

export function Chat() {
  return (
    <div className="px-8 md:px-12 pt-6 md:pt-8 pb-14 md:pb-24 max-w-3xl mx-auto flex flex-col space-y-3 md:space-y-4">
      <ChatMessages />
      <ChatPanel />
    </div>
  )
}
