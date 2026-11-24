'use client'

import {
  IconDeviceLaptop as Laptop,
  IconMoon as Moon,
  IconSun as Sun
} from '@tabler/icons-react'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

import { useI18n } from '@/components/language-provider'
import { useTheme } from '@/components/theme-provider'

export function ThemeMenuItems() {
  const { t } = useI18n()
  const { setTheme } = useTheme()

  return (
    <>
      <DropdownMenuItem onClick={() => setTheme('light')}>
        <Sun className="size-4" />
        <span>{t('Light')}</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('dark')}>
        <Moon className="size-4" />
        <span>{t('Dark')}</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('system')}>
        <Laptop className="size-4" />
        <span>{t('System')}</span>
      </DropdownMenuItem>
    </>
  )
}
