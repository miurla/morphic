import React from 'react'
import { History } from './history'
import { HistoryList } from './history-list'

const HistoryContainer: React.FC = async () => {
  // Log para verificar o valor lido
  console.log(
    '[HistoryContainer] Checking ENV VAR - ENABLE_SAVE_CHAT_HISTORY:',
    process.env.ENABLE_SAVE_CHAT_HISTORY
  )
  const enableSaveChatHistory = process.env.ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    console.log('[HistoryContainer] History disabled by ENV VAR.')
    return null
  }

  console.log('[HistoryContainer] History enabled, rendering...')
  return (
    <div>
      <History>
        <HistoryList />
      </History>
    </div>
  )
}

export default HistoryContainer
