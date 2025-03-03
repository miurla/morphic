import React from 'react'
import { History } from './history'
import { HistoryList } from './history-list'

const HistoryContainer: React.FC = async () => {
  const enableSaveChatHistory = process.env.ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    return null
  }

  return (
    <div>
      <History>
        <HistoryList userId="anonymous" />
      </History>
    </div>
  )
}

export default HistoryContainer
