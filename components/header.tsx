'use client'

import React, { useState } from 'react'
import { usePathname } from 'next/navigation'

import { User } from '@supabase/supabase-js'

import { cn } from '@/lib/utils'

import { useSidebar } from '@/components/ui/sidebar'

import { FeedbackModal } from './feedback-modal'
import GuestMenu from './guest-menu'
import UserMenu from './user-menu'

interface HeaderProps {
  user: User | null
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const { open } = useSidebar()
  const pathname = usePathname()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const isSearchPage = pathname === '/' || pathname.startsWith('/search')

  return (
    <>
      <header
        className={cn(
          'absolute top-0 right-0 p-2 md:p-3 flex justify-between items-center z-10 backdrop-blur-sm lg:backdrop-blur-none bg-background/80 lg:bg-transparent transition-[width] duration-200 ease-linear',
          open ? 'md:w-[calc(100%-var(--sidebar-width))]' : 'md:w-full',
          'w-full'
        )}
      >
        {/* This div can be used for a logo or title on the left if needed */}
        <div></div>

        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu user={user} onFeedback={() => setFeedbackOpen(true)} />
          ) : (
            <GuestMenu onFeedback={() => setFeedbackOpen(true)} />
          )}
        </div>
      </header>

      {isSearchPage && (
        <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      )}
    </>
  )
}

export default Header
