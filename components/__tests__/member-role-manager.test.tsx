import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { promoteMemberAction } from '@/lib/actions/admin'

import { MemberRoleManager } from '@/components/admin/member-role-manager'

vi.mock('@/lib/actions/admin', () => ({
  promoteMemberAction: vi.fn()
}))

const members = [
  { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'admin' },
  { id: 'user-1', email: 'member@example.com', name: 'Member', role: 'user' }
]

describe('MemberRoleManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('promotes a member and marks the row', async () => {
    vi.mocked(promoteMemberAction).mockResolvedValue({ success: true })

    render(<MemberRoleManager members={members} />)

    fireEvent.click(screen.getByRole('button', { name: 'Promote to admin' }))

    await waitFor(() => {
      expect(promoteMemberAction).toHaveBeenCalledWith({ userId: 'user-1' })
      expect(screen.getByText('Promoted')).toBeInTheDocument()
    })
    expect(
      screen.queryByRole('button', { name: 'Promote to admin' })
    ).toBeNull()
  })

  it('shows the error when promotion fails', async () => {
    vi.mocked(promoteMemberAction).mockResolvedValue({
      success: false,
      error: 'Admin access required.'
    })

    render(<MemberRoleManager members={members} />)

    fireEvent.click(screen.getByRole('button', { name: 'Promote to admin' }))

    await waitFor(() => {
      expect(screen.getByText('Admin access required.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Promoted')).not.toBeInTheDocument()
  })

  it('renders no promote button for existing admins', () => {
    render(<MemberRoleManager members={[members[0]]} />)

    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Promote to admin' })
    ).toBeNull()
  })
})
