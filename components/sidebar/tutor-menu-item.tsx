'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { IconSchool } from '@tabler/icons-react'

import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar'

import { useI18n } from '@/components/language-provider'
import { useLibrary } from '@/components/library/library-context'

export function TutorMenuItem() {
  const pathname = usePathname()
  const { t } = useI18n()
  const { closeLibrary } = useLibrary()
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={pathname?.startsWith('/tutor')}>
        <Link
          href="/tutor"
          onClick={() => {
            closeLibrary()
            setOpenMobile(false)
          }}
        >
          <IconSchool className="size-4" aria-hidden />
          <span>{t('Tutor')}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
