'use client'

import { useState } from 'react'
import Link from 'next/link'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { NativeIcon } from '@/components/native/native-icon'
import { NativePressable } from '@/components/native/native-pressable'

import { ExternalLinkItems } from './external-link-items'
import { ThemeMenuItems } from './theme-menu-items'

interface GuestMenuProps {
  onFeedback: () => void
}

export default function GuestMenu({ onFeedback }: GuestMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const handleFeedback = () => {
    setMenuOpen(false)
    window.setTimeout(onFeedback, 0)
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <NativePressable
          type="button"
          pressScale={0.94}
          className="native-menu-trigger relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,box-shadow,transform] duration-[140ms] ease-[var(--motion-ease-out)] hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <NativeIcon name="settings" className="size-4" />
          <span className="sr-only">Open menu</span>
        </NativePressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-1.5" align="end" forceMount>
        <DropdownMenuItem asChild>
          <Link href="/auth/login">
            <NativeIcon name="login" className="size-4" />
            <span>Sign In</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={event => {
            event.preventDefault()
            handleFeedback()
          }}
        >
          <NativeIcon name="message" className="size-4" />
          <span>Feedback</span>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <NativeIcon name="settings" className="size-4" />
            <span>Search Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <NativeIcon name="theme" className="size-4" />
            <span>Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="p-1.5">
            <ThemeMenuItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <NativeIcon name="link" className="size-4" />
            <span>Links</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="p-1.5">
            <ExternalLinkItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
