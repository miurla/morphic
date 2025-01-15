import React from 'react'
import { CollapsibleMessage } from './collapsible-message'

type UserMessageProps = {
  message: string
}

export const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  return (
    <CollapsibleMessage role="user">
      <div className="flex-1 break-words w-full">{message}</div>
    </CollapsibleMessage>
  )
}
