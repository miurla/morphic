'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import type { User } from '@supabase/supabase-js'
import {
  IconLink as Link2,
  IconLogout as LogOut,
  IconMessageCircle as MessageCircle,
  IconSettings as Settings,
  IconUserCircle as UserRound
} from '@tabler/icons-react'

import { createClient } from '@/lib/supabase/client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { AccountSettingsDialog } from '@/components/account-settings-dialog'

import { Button } from './ui/button'
import { ExternalLinkItems } from './external-link-items'

interface UserMenuProps {
  user: User
  onFeedback: () => void
}

export default function UserMenu({ user, onFeedback }: UserMenuProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const userName =
    user.user_metadata?.full_name || user.user_metadata?.name || 'User'
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture

  const getInitials = (name: string, email: string | undefined) => {
    if (name && name !== 'User') {
      const names = name.split(' ')
      if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.split('@')[0].substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleOpenAccount = () => {
    setMenuOpen(false)
    window.setTimeout(() => setAccountOpen(true), 0)
  }

  const handleFeedback = () => {
    setMenuOpen(false)
    window.setTimeout(onFeedback, 0)
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="native-menu-trigger relative size-9 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Avatar className="size-7">
              <AvatarImage src={avatarUrl} alt={userName} />
              <AvatarFallback>
                {getInitials(userName, user.email)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none truncate">
                {userName}
              </p>
              <p className="text-xs leading-none text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={event => {
              event.preventDefault()
              handleOpenAccount()
            }}
          >
            <UserRound className="size-4" />
            <span>Account</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpen(false)
              router.push('/settings')
            }}
          >
            <Settings className="size-4" />
            <span>Search Settings</span>
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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Link2 className="size-4" />
              <span>Links</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <ExternalLinkItems />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="size-4" />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AccountSettingsDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        user={user}
      />
    </>
  )
}
