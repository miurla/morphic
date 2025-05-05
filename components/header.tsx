import React from 'react'
import { ModeToggle } from './mode-toggle'

export const Header: React.FC = async () => {
  return (
    <header className="absolute right-0 p-2 items-center z-10 backdrop-blur lg:backdrop-blur-none bg-background/80 lg:bg-transparent">
      <div className="flex gap-0.5">
        <ModeToggle />
      </div>
    </header>
  )
}

export default Header
