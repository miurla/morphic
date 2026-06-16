'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

import { NativeIcon } from '@/components/native/native-icon'
import { useTheme } from '@/components/theme-provider'

export function ThemeMenuItems() {
  const { setTheme } = useTheme()

  return (
    <>
      <DropdownMenuItem onClick={() => setTheme('light')}>
        <NativeIcon name="themeLight" className="size-4" />
        <span>Light</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('dark')}>
        <NativeIcon name="themeDark" className="size-4" />
        <span>Dark</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('system')}>
        <NativeIcon name="themeSystem" className="size-4" />
        <span>System</span>
      </DropdownMenuItem>
    </>
  )
}
