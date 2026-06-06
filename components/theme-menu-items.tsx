'use client'

import { HalfMoon, Laptop, SunLight } from 'iconoir-react'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

import { useTheme } from '@/components/theme-provider'

export function ThemeMenuItems() {
  const { setTheme } = useTheme()

  return (
    <>
      <DropdownMenuItem onClick={() => setTheme('light')}>
        <SunLight className="size-4" />
        <span>Light</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('dark')}>
        <HalfMoon className="size-4" />
        <span>Dark</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('system')}>
        <Laptop className="size-4" />
        <span>System</span>
      </DropdownMenuItem>
    </>
  )
}
