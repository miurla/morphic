import { cn } from '@/lib/utils'
import React from 'react'
import HistoryContainer from './history-container'
import { ModeToggle } from './mode-toggle'
import { IconLogo } from './ui/icons'

export const Header: React.FC = async () => {
  return (
    <header className="fixed w-full p-2 flex justify-between items-center z-10 backdrop-blur lg:backdrop-blur-none bg-background/80 lg:bg-transparent">
      <div>
        <a href="/">
          <IconLogo className={cn('w-5 h-5')} />
          <span className="sr-only">Morphic</span>
        </a>
      </div>
      <div className="flex gap-0.5">
        <ModeToggle />
        <HistoryContainer />
      </div>
    </header>
  )
}

export default Header
