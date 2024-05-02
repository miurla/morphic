import React from 'react'
import { ModeToggle } from './mode-toggle'
import { IconLogo } from './ui/icons'
import { cn } from '@/lib/utils'
import { cache } from 'react'
import { History } from './history'
import { getChats } from '@/lib/actions/chat'

export const Header: React.FC = async () => {
  const chats = await getChats('anonymous')
  return (
    <header className="fixed w-full p-1 md:p-2 flex justify-between items-center z-10 backdrop-blur md:backdrop-blur-none bg-background/80 md:bg-transparent">
      <div>
        <a href="/">
          <IconLogo className={cn('w-5 h-5')} />
          <span className="sr-only">Morphic</span>
        </a>
      </div>
      <div className="flex gap-0.5">
        <ModeToggle />
        <div className="sm:hidden block">
          <History location="header" chats={chats} />
        </div>
      </div>
    </header>
  )
}

export default Header
