import React from 'react'
import Link from 'next/link'
import { Chat } from '@/lib/types'

type HistoryItemProps = {
  chat: Chat
}

const formatDateWithTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return `Today, ${date.getHours()}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`
  } else if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return `Yesterday, ${date.getHours()}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`
  } else {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }
}

const HistoryItem: React.FC<HistoryItemProps> = ({ chat }) => {
  return (
    <Link
      href={chat.path}
      className="flex flex-col hover:bg-muted cursor-pointer p-2 rounded"
    >
      <div className="text-xs font-medium truncate select-none">
        {chat.title}
      </div>
      <div className="text-xs text-muted-foreground">
        {formatDateWithTime(chat.createdAt as string)}
      </div>
    </Link>
  )
}

export default HistoryItem
