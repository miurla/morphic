'use client'

import { IconPlus as Plus } from '@tabler/icons-react'

import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

import { useI18n } from '@/components/language-provider'

import { HomeLink } from './home-link'

export function NewChatMenuItem() {
  const { t } = useI18n()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <HomeLink className="flex items-center gap-2">
          <Plus className="size-4" />
          <span>{t('New')}</span>
        </HomeLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
