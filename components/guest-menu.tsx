'use client'

import { useState } from 'react'
import Link from 'next/link'

import {
  IconLink as Link2,
  IconLogin as LogIn,
  IconMessageCircle as MessageCircle,
  IconPalette as Palette,
  IconSettings as Settings2
} from '@tabler/icons-react'

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
          <Settings2 className="size-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-1.5" align="end" forceMount>
        <DropdownMenuItem asChild>
          <Link href="/auth/login">
            <LogIn className="size-4" />
            <span>Sign In</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={event => {
            event.preventDefault()
            handleFeedback()
          }}
        >
          <MessageCircle className="size-4" />
          <span>Feedback</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="size-4" />
            <span>Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="p-1.5">
            <ThemeMenuItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Link2 className="size-4" />
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
