import React from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

type HistoryItemProps = {
  query: string
  date: string
}

const HistoryItem: React.FC<HistoryItemProps> = ({ query, date }) => {
  return (
    <Link
      href={`/search?q=${query}`}
      className="flex flex-col hover:bg-muted cursor-pointer p-2 rounded"
    >
      <div className="text-xs font-medium truncate select-none">{query}</div>
      <div className="text-xs text-muted-foreground">{date}</div>
    </Link>
  )
}

export default HistoryItem
