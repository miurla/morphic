'use client'

import { IconPlus as Plus } from '@tabler/icons-react'

import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

import { HomeLink } from './home-link'

export function NewChatMenuItem() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <HomeLink className="flex items-center gap-2">
          <Plus className="size-4" />
          <span>New</span>
        </HomeLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
