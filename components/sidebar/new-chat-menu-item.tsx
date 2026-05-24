'use client'

import Link from 'next/link'

import { IconPlus as Plus } from '@tabler/icons-react'

import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

export function NewChatMenuItem() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <Link href="/" className="flex items-center gap-2">
          <Plus className="size-4" />
          <span>New</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
