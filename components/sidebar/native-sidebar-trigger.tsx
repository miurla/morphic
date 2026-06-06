'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { NativeIcon } from '@/components/native/native-icon'

const NativeSidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar()
  const isSidebarOpen = isMobile ? openMobile : open

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn('size-6', className)}
      onClick={event => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <NativeIcon
        name={isSidebarOpen ? 'sidebarOpen' : 'sidebarClosed'}
        size={18}
      />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
NativeSidebarTrigger.displayName = 'NativeSidebarTrigger'

export { NativeSidebarTrigger }
