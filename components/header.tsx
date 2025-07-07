'use client'

import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { User } from '@supabase/supabase-js'
import { BookOpen } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import GuestMenu from './guest-menu'
import { Button } from './ui/button'
import UserMenu from './user-menu'

interface HeaderProps {
  user: User | null
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const { open } = useSidebar()
  return (
    <header
      className={cn(
        'absolute top-0 right-0 p-2 flex justify-between items-center z-10 backdrop-blur lg:backdrop-blur-none bg-background/80 lg:bg-transparent transition-[width] duration-200 ease-linear',
        open ? 'md:w-[calc(100%-var(--sidebar-width))]' : 'md:w-full',
        'w-full'
      )}
    >
      {/* This div can be used for a logo or title on the left if needed */}
      <div></div>

      <div className="flex items-center gap-2">
        {/* Learn Button */}
        <Link href="/lessons">
          <Button variant="outline" size="sm">
            <BookOpen className="h-4 w-4 mr-1" />
            Learn
          </Button>
        </Link>
        
        {user ? <UserMenu user={user} /> : <GuestMenu />}
      </div>
    </header>
  )
}

export default Header
