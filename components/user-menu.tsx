'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import type { User } from '@supabase/supabase-js'
import {
  Link as LinkIcon,
  LogOut,
  Message,
  Settings,
  UserCircle
} from 'iconoir-react'

import { createClient } from '@/lib/supabase/client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { NativePressable } from '@/components/native/native-pressable'
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
          <NativePressable
            type="button"
            pressScale={0.94}
            className="native-menu-trigger relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,box-shadow,transform] duration-[140ms] ease-[var(--motion-ease-out)] hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Avatar className="size-7">
              <AvatarImage src={avatarUrl} alt={userName} />
              <AvatarFallback>
                {getInitials(userName, user.email)}
              </AvatarFallback>
            </Avatar>
          </NativePressable>
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
            <UserCircle className="size-4" />
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
            <Message className="size-4" />
            <span>Feedback</span>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <LinkIcon className="size-4" />
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
