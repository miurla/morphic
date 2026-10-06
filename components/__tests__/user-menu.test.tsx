import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { signOut } from '@/lib/actions/auth'
import type { AppUser } from '@/lib/auth/types'
import { AppUserProvider } from '@/lib/contexts/app-user-context'

import UserMenu from '@/components/user-menu'

vi.mock('@/lib/actions/auth', () => ({
  signOut: vi.fn()
}))

const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn()
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh })
}))

vi.mock('@/components/usage-budget-provider', () => ({
  useUsageBudget: () => ({
    usage: null,
    isLow: false,
    isExhausted: false,
    refreshUsage: vi.fn()
  })
}))

vi.mock('@/components/account-settings-dialog', () => ({
  AccountSettingsDialog: () => null
}))

vi.mock('@/components/external-link-items', () => ({
  ExternalLinkItems: () => null
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    onClick
  }: {
    children: React.ReactNode
    onSelect?: (event: { preventDefault: () => void }) => void
    onClick?: () => void
  }) => (
    <button
      role="menuitem"
      onClick={() => {
        onSelect?.({ preventDefault: vi.fn() })
        onClick?.()
      }}
    >
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) =>
    children,
  DropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => children
}))

const user: AppUser = {
  id: 'user-1',
  email: 'person@example.com',
  name: 'Test Person'
}

const capabilities = { signUp: true, passwordReset: true, deleteUser: true }

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs out through the auth server action and refreshes the router', async () => {
    vi.mocked(signOut).mockResolvedValue({ success: true })
    render(
      <AppUserProvider user={user} capabilities={capabilities}>
        <UserMenu user={user} />
      </AppUserProvider>
    )

    fireEvent.click(screen.getByRole('menuitem', { name: /Logout/ }))

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows the user profile information', () => {
    render(
      <AppUserProvider user={user} capabilities={capabilities}>
        <UserMenu user={user} />
      </AppUserProvider>
    )

    expect(screen.getByText('Test Person')).toBeInTheDocument()
    expect(screen.getByText('person@example.com')).toBeInTheDocument()
  })
})
