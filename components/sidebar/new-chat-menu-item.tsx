'use client'

import Link from 'next/link'

import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

import { NativeIcon } from '@/components/native/native-icon'

export function NewChatMenuItem() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <Link href="/" className="flex items-center gap-2">
          <NativeIcon name="newChat" className="size-4" />
          <span>New</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
