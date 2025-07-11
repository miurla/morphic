'use client'

import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { User } from '@supabase/supabase-js'
import Image from 'next/image'
import React from 'react'
import GuestMenu from './guest-menu'
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
      {/* Local 825 Logo and Branding */}
      <div className="flex items-center gap-3">
        <Image
          src="/images/local825-logo.png"
          alt="Local 825 Logo"
          width={40}
          height={40}
          className="rounded-md"
        />
        <div className="hidden sm:block">
          <h1 className="text-lg font-semibold text-foreground">
            Bulldozer Search
          </h1>
          <p className="text-xs text-muted-foreground">
            Construction Industry Intelligence
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {user ? <UserMenu user={user} /> : <GuestMenu />}
      </div>
    </header>
  )
}

export default Header
