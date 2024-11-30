import React from 'react'
import { History } from './history'
import { HistoryList } from './history-list'

type HistoryContainerProps = {
  location: 'sidebar' | 'header'
}

const HistoryContainer: React.FC<HistoryContainerProps> = async ({
  location
}) => {
  return (
    <div
      className={location === 'header' ? 'block sm:hidden' : 'hidden sm:block'}
    >
      <History location={location}>
        <HistoryList userId="anonymous" />
      </History>
    </div>
  )
}

export default HistoryContainer
