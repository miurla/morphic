import { Suspense } from 'react'
import Link from 'next/link'

import { cn } from '@/lib/utils'

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarRail,
  SidebarTrigger
} from '@/components/ui/sidebar'

import { ChatHistorySection } from './sidebar/chat-history-section'
import { ChatHistorySkeleton } from './sidebar/chat-history-skeleton'
import { LibraryMenuItem } from './sidebar/library-menu-item'
import { NewChatMenuItem } from './sidebar/new-chat-menu-item'
import { IconLogo } from './ui/icons'

export default function AppSidebar() {
  // Anonymous mode has no per-user library, and the server actions reject it,
  // so the entry point follows the same switch the pages use.
  const libraryAvailable = process.env.ENABLE_AUTH !== 'false'

  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="flex flex-row justify-between items-center">
        <Link href="/" className="flex items-center gap-2 px-2 py-3">
          <IconLogo className={cn('size-5')} />
          <span className="font-semibold text-sm">Morphic</span>
        </Link>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent className="flex flex-col px-2 py-4 h-full">
        <SidebarMenu>
          <NewChatMenuItem />
          {libraryAvailable && <LibraryMenuItem />}
        </SidebarMenu>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<ChatHistorySkeleton />}>
            <ChatHistorySection />
          </Suspense>
        </div>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
