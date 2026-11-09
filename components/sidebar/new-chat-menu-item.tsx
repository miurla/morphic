'use client'

import Link from 'next/link'

import { IconPlus as Plus } from '@tabler/icons-react'

import { SHORTCUT_EVENTS } from '@/lib/keyboard-shortcuts'

import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

export function NewChatMenuItem() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <Link
          href="/"
          className="flex items-center gap-2"
          onClick={event => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            ) {
              return
            }

            const handled = !window.dispatchEvent(
              new CustomEvent(SHORTCUT_EVENTS.newChat, { cancelable: true })
            )
            if (handled) event.preventDefault()
          }}
        >
          <Plus className="size-4" />
          <span>New</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
