'use client'

import { useState } from 'react'
import Link from 'next/link'

import { NativeIcon } from '@/components/native/native-icon'
import { Button } from '@/components/ui/button'
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
        <Button
          variant="ghost"
          size="icon"
          className="native-menu-trigger size-9 rounded-full text-muted-foreground hover:text-foreground"
        >
          <NativeIcon name="settings" className="size-4" />
          <span className="sr-only">Open menu</span>
        </Button>
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
