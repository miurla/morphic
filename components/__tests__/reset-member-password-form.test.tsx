import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resetMemberPasswordAction } from '@/lib/actions/admin'

import { ResetMemberPasswordForm } from '@/components/admin/reset-member-password-form'

vi.mock('@/lib/actions/admin', () => ({
  resetMemberPasswordAction: vi.fn()
}))

const members = [
  { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'admin' },
  { id: 'user-1', email: 'member@example.com', name: 'Member', role: 'user' }
]

describe('ResetMemberPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets a member password', async () => {
    vi.mocked(resetMemberPasswordAction).mockResolvedValue({ success: true })

    render(<ResetMemberPasswordForm members={members} />)

    fireEvent.change(screen.getByLabelText('Member'), {
      target: { value: 'user-1' }
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'brand-new-password' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      expect(resetMemberPasswordAction).toHaveBeenCalledWith({
        userId: 'user-1',
        newPassword: 'brand-new-password'
      })
      expect(screen.getByText('Password updated.')).toBeInTheDocument()
    })
  })

  it('shows the error when a non-admin is denied', async () => {
    vi.mocked(resetMemberPasswordAction).mockResolvedValue({
      success: false,
      error: 'Admin access required.'
    })

    render(<ResetMemberPasswordForm members={members} />)

    fireEvent.change(screen.getByLabelText('Member'), {
      target: { value: 'user-1' }
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'brand-new-password' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      expect(screen.getByText('Admin access required.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Password updated.')).not.toBeInTheDocument()
  })

  it('disables submit until a member is selected', () => {
    render(<ResetMemberPasswordForm members={members} />)

    expect(
      screen.getByRole('button', { name: 'Reset password' })
    ).toBeDisabled()
  })
})
