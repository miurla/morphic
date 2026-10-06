import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createInvitationAction,
  type InvitationView,
  revokeInvitationAction
} from '@/lib/actions/admin'

import { InvitationsManager } from '@/components/admin/invitations-manager'

vi.mock('@/lib/actions/admin', () => ({
  createInvitationAction: vi.fn(),
  revokeInvitationAction: vi.fn()
}))

const invitations: InvitationView[] = [
  {
    id: 'inv-1',
    email: 'friend@example.com',
    token: 'tok1',
    revoked: false,
    used: false,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString()
  },
  {
    id: 'inv-2',
    email: 'old@example.com',
    token: 'tok2',
    revoked: true,
    used: false,
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
    createdAt: new Date().toISOString()
  }
]

describe('InvitationsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists invitations with their status', () => {
    render(<InvitationsManager invitations={invitations} />)

    expect(screen.getByText('friend@example.com')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Revoked')).toBeInTheDocument()
    expect(screen.queryByText('old@example.com')).toBeInTheDocument()
  })

  it('creates an invitation and shows a copyable link', async () => {
    const created: InvitationView = {
      id: 'inv-3',
      email: 'new@example.com',
      token: 'tok3',
      revoked: false,
      used: false,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString()
    }
    vi.mocked(createInvitationAction).mockResolvedValue({
      success: true,
      invitation: created,
      link: 'http://localhost:3000/auth/sign-up?token=tok3'
    })

    render(<InvitationsManager invitations={invitations} />)

    fireEvent.change(screen.getByPlaceholderText(/invitee/i), {
      target: { value: 'new@example.com' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create invitation' }))

    await waitFor(() => {
      expect(createInvitationAction).toHaveBeenCalledWith({
        email: 'new@example.com'
      })
      expect(screen.getByText('new@example.com')).toBeInTheDocument()
      expect(
        screen.getByDisplayValue(
          'http://localhost:3000/auth/sign-up?token=tok3'
        )
      ).toBeInTheDocument()
    })
  })

  it('shows the error when a non-admin is denied', async () => {
    vi.mocked(createInvitationAction).mockResolvedValue({
      success: false,
      error: 'Admin access required.'
    })

    render(<InvitationsManager invitations={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create invitation' }))

    await waitFor(() => {
      expect(screen.getByText('Admin access required.')).toBeInTheDocument()
    })
  })

  it('revokes an invitation', async () => {
    vi.mocked(revokeInvitationAction).mockResolvedValue({ success: true })

    render(<InvitationsManager invitations={invitations} />)

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(revokeInvitationAction).toHaveBeenCalledWith('inv-1')
      expect(screen.getAllByText('Revoked')).toHaveLength(2)
    })
  })
})
