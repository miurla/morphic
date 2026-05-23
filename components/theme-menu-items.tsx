'use client'

import { useTheme } from 'next-themes'

import {
  IconDeviceLaptop as Laptop,
  IconMoon as Moon,
  IconSun as Sun
} from '@tabler/icons-react'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

export function ThemeMenuItems() {
  const { setTheme } = useTheme()

  return (
    <>
      <DropdownMenuItem onClick={() => setTheme('light')}>
        <Sun className="size-4" />
        <span>Light</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('dark')}>
        <Moon className="size-4" />
        <span>Dark</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('system')}>
        <Laptop className="size-4" />
        <span>System</span>
      </DropdownMenuItem>
    </>
  )
}
