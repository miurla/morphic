import React from 'react'
import { ChatShare } from './chat-share'
import { ClearChat } from './clear-session'

type UserMessageProps = {
  message: string
  chatId?: string
  showShare?: boolean
  showDelete?: boolean
}

export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  chatId,
  showShare = false,
  showDelete = false
}) => {
  const enableDelete = process.env.ENABLE_DELETE === 'true'
  const enableShare = process.env.ENABLE_SHARE === 'true'
  return (
    <div className="flex items-center w-full space-x-1 mt-2 min-h-10">
      <div className="text-xl flex-1 break-words w-full">{message}</div>
      {enableShare && showShare && chatId && <ChatShare chatId={chatId} />}
      {enableDelete && showDelete && chatId && <ClearChat  chatId={chatId} />}
    </div>
  )
}
