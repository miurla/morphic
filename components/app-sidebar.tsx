import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarTrigger
} from '@/components/ui/sidebar'
import { getChats } from '@/lib/actions/chat'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { IconLogo } from './ui/icons'

export default function AppSidebar() {
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
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/?new=true" className="flex items-center gap-2">
                <Plus className="size-4" />
                <span>New</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-6 flex-1 overflow-y-auto">
          <Suspense fallback={<NavChatsSkeleton />}>
            <ChatHistorySection />
          </Suspense>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}

function NavChatsSkeleton() {
  return (
    <SidebarMenu>
      {Array.from({ length: 5 }).map((_, idx) => (
        <SidebarMenuItem key={idx}>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

async function ChatHistorySection() {
  const chats = await getChats()
  return (
    <SidebarMenu>
      {chats.map(chat => (
        <SidebarMenuItem key={chat.id}>
          <SidebarMenuButton asChild>
            <Link
              href={`/chat?chatId=${chat.id}`}
              className="flex items-center gap-2 truncate"
            >
              <span>{chat.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
