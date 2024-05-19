import React from 'react'
import { History } from './history'

type HistoryContainerProps = {
  location: 'sidebar' | 'header'
}

const HistoryContainer: React.FC<HistoryContainerProps> = async ({
  location
}) => {
  return (
    <div className="sm:hidden block">
      <History location={location} />
    </div>
  )
}

export default HistoryContainer
