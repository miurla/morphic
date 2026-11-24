'use client'

import { IconLibrary } from '@tabler/icons-react'

import { captureClient } from '@/lib/analytics/posthog-client'

import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

import { useI18n } from '@/components/language-provider'
import { useLibrary } from '@/components/library/library-context'

export function LibraryMenuItem() {
  const { t } = useI18n()

  const { isOpen, toggleLibrary } = useLibrary()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          toggleLibrary()
          captureClient(isOpen ? 'library_closed' : 'library_opened', {
            source: 'sidebar'
          })
        }}
      >
        <IconLibrary className="size-4" />
        <span>{t('Library')}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
