'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  IconChartBar as ChartBar,
  IconLink as Link2,
  IconLogout as LogOut,
  IconShield,
  IconUserCircle as UserRound
} from '@tabler/icons-react'

import { signOut } from '@/lib/actions/auth'
import type { AppUser } from '@/lib/auth/types'

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
import { useUsageBudget } from '@/components/usage-budget-provider'
import { UsageDialog } from '@/components/usage-dialog'

import { Button } from './ui/button'
import { ExternalLinkItems } from './external-link-items'

interface UserMenuProps {
  user: AppUser
}

export default function UserMenu({ user }: UserMenuProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const { usage, isLow, isExhausted, refreshUsage } = useUsageBudget()
  const userName = user.name || 'User'
  const avatarUrl = user.image ?? undefined

  const getInitials = (name: string, email: string | null | undefined) => {
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
    await signOut()
    router.push('/')
    router.refresh()
  }

  const handleOpenAccount = () => {
    setMenuOpen(false)
    window.setTimeout(() => setAccountOpen(true), 0)
  }

  const handleOpenUsage = () => {
    setMenuOpen(false)
    window.setTimeout(() => {
      setUsageOpen(true)
      void refreshUsage()
    }, 0)
  }

  const accountMenuLabel = isExhausted
    ? 'Open account menu. Monthly usage limit reached.'
    : isLow
      ? 'Open account menu. Monthly usage is running low.'
      : 'Open account menu'

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative size-6 rounded-full"
            aria-label={accountMenuLabel}
          >
            <Avatar className="size-6">
              <AvatarImage src={avatarUrl} alt={userName} />
              <AvatarFallback>
                {getInitials(userName, user.email)}
              </AvatarFallback>
            </Avatar>
            {isLow && (
              <span
                className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive ring-2 ring-background"
                aria-hidden="true"
                data-testid="usage-status-dot"
              />
            )}
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
          {user.role === 'admin' && (
            <DropdownMenuItem asChild>
              <Link href="/auth/admin">
                <IconShield className="size-4" />
                <span>Admin</span>
              </Link>
            </DropdownMenuItem>
          )}
          {usage && (
            <DropdownMenuItem
              onSelect={event => {
                event.preventDefault()
                handleOpenUsage()
              }}
            >
              <ChartBar className="size-4" />
              <span>Usage</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {usage.remaining} / {usage.limit}
              </span>
            </DropdownMenuItem>
          )}
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
      {usage && (
        <UsageDialog
          open={usageOpen}
          onOpenChange={setUsageOpen}
          usage={usage}
        />
      )}
    </>
  )
}
