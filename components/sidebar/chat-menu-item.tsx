'use client'

import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { Chat } from '@/lib/types'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface ChatMenuItemProps {
  chat: Chat
}

export function ChatMenuItem({ chat }: ChatMenuItemProps) {
  const pathname = usePathname()
  const isActive = pathname === chat.path

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild data-active={isActive}>
        <Link
          href={chat.path}
          className={cn(
            'flex items-center gap-2 truncate text-sm'
            // Additional styles for active state can be handled by
            // the parent component's data-active attribute or sidebar CSS variables
          )}
        >
          <span>{chat.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
