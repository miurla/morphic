import React from 'react'
import { History } from './history'
import { HistoryList } from './history-list'

type HistoryContainerProps = {
  location: 'sidebar' | 'header'
}

const HistoryContainer: React.FC<HistoryContainerProps> = async ({
  location
}) => {
  const enableSaveChatHistory =
    process.env.NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    return null
  }

  return (
    <div
      className={location === 'header' ? 'block lg:hidden' : 'hidden sm:block'}
    >
      <History location={location}>
        <HistoryList userId="anonymous" />
      </History>
    </div>
  )
}

export default HistoryContainer
