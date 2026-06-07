'use client'

import React, { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { User } from '@supabase/supabase-js'

import { cn } from '@/lib/utils'

import { useSidebar } from '@/components/ui/sidebar'
import { NativePressable } from '@/components/native/native-pressable'
import { NativeIcon } from '@/components/native/native-icon'

import { FeedbackModal } from './feedback-modal'
import GuestMenu from './guest-menu'
import UserMenu from './user-menu'

interface HeaderProps {
  user: User | null
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const { open } = useSidebar()
  const pathname = usePathname()
  const router = useRouter()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const isSearchPage = pathname === '/' || pathname.startsWith('/search')
  const showBackButton = pathname.startsWith('/search') && pathname !== '/'

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
        <div>
          {showBackButton && (
            <NativePressable
              type="button"
              pressScale={0.94}
              onClick={() => router.push('/')}
              className="relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,box-shadow,transform] duration-[140ms] ease-[var(--motion-ease-out)] hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Back to search"
            >
              <NativeIcon name="arrowLeft" className="size-4" />
            </NativePressable>
          )}
        </div>

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
