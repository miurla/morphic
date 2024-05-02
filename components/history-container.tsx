import React from 'react'
import { History } from './history'
import { getChats } from '@/lib/actions/chat'
import { cache } from 'react'

type HistoryContainerProps = {
  location: 'sidebar' | 'header'
}
const loadChats = cache(async (userId?: string) => {
  return await getChats(userId)
})

const HistoryContainer: React.FC<HistoryContainerProps> = async ({
  location
}) => {
  const chats = await loadChats('anonymous')
  return (
    <div className="sm:hidden block">
      <History location={location} chats={chats} />
    </div>
  )
}

export default HistoryContainer
