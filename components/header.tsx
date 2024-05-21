import React from 'react'
import { ModeToggle } from './mode-toggle'
import { IconLogo } from './ui/icons'
import { cn } from '@/lib/utils'
import HistoryContainer from './history-container'
import { Button } from '@/components/ui/button'
import { ArrowRight, Plus } from 'lucide-react'



export const Header: React.FC = async () => {
  return (
    <header className="fixed w-full p-1 md:p-2 flex justify-between items-center z-10 backdrop-blur md:backdrop-blur-none bg-background/80 md:bg-transparent">
      <div>
        <a href="/">
          <IconLogo className={cn('w-5 h-5')} />
          <span className="sr-only">Fetchit</span>
        </a>
      </div>
      <div className="flex gap-0.5">
        This is
          <Button
            type="submit"
            size={'icon'}
            variant={'ghost'}
            className="absolute right-2 top-1/2 transform -translate-y-1/2"
            disabled={false}
          >
            <ArrowRight size={20} />
          </Button>
        <ModeToggle />
        <HistoryContainer location="header" />
      </div>
    </header>
  )
}

export default Header
