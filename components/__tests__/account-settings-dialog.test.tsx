import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteAccount } from '@/lib/actions/account'
import { signOut } from '@/lib/actions/auth'
import type { AppUser } from '@/lib/auth/types'
import { AppUserProvider } from '@/lib/contexts/app-user-context'

import { AccountSettingsDialog } from '@/components/account-settings-dialog'

vi.mock('@/lib/actions/account', () => ({
  deleteAccount: vi.fn()
}))

vi.mock('@/lib/actions/auth', () => ({
  signOut: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn()
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh })
}))

const user: AppUser = {
  id: 'user-1',
  email: 'person@example.com',
  name: 'Test Person'
}

const capabilities = {
  signUp: true,
  passwordReset: true,
  deleteUser: true,
  oauth: false,
  emailVerification: false
}

function renderDialog(override: Partial<typeof capabilities> = {}) {
  return render(
    <AppUserProvider
      user={user}
      capabilities={{ ...capabilities, ...override }}
    >
      <AccountSettingsDialog open onOpenChange={vi.fn()} user={user} />
    </AppUserProvider>
  )
}

describe('AccountSettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the delete-account entry point when the provider supports it', () => {
    renderDialog()
    expect(
      screen.getByRole('button', { name: 'Delete account' })
    ).toBeInTheDocument()
  })

  it('hides the delete-account entry point when the provider lacks the capability', () => {
    renderDialog({ deleteUser: false })
    expect(
      screen.queryByRole('button', { name: 'Delete account' })
    ).not.toBeInTheDocument()
  })

  it('deletes the account and clears the session', async () => {
    vi.mocked(deleteAccount).mockResolvedValue({ success: true })
    vi.mocked(signOut).mockResolvedValue({ success: true })
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete account' }).at(-1)!
    )

    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledTimes(1)
      expect(signOut).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('surfaces deletion errors', async () => {
    vi.mocked(deleteAccount).mockResolvedValue({
      success: false,
      error: 'Account deletion is unavailable in anonymous mode.'
    })
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete account' }).at(-1)!
    )

    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledTimes(1)
      expect(signOut).not.toHaveBeenCalled()
    })
  })
})
