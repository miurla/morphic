import React from 'react'

type UserMessageProps = {
  message: string
}

export const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  return (
    <div className="mt-6">
      <div className="text-xl">{message}</div>
    </div>
  )
}
