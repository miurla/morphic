import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    revoked: false,
    used: false,
    expired: false,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString()
  },
  {
    id: 'inv-2',
    email: 'old@example.com',
    revoked: true,
    used: false,
    expired: false,
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

  it('marks elapsed invitations as expired without a revoke action', () => {
    render(
      <InvitationsManager
        invitations={[
          {
            id: 'inv-4',
            email: 'gone@example.com',
            revoked: false,
            used: false,
            expired: true,
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
            createdAt: new Date().toISOString()
          }
        ]}
      />
    )

    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
    expect(screen.queryByText('Revoke')).not.toBeInTheDocument()
  })

  it('rechecks expiration while the page stays open', async () => {
    // The server-computed flag says active, but the link elapsed after
    // the page rendered: the client clock tick must catch up.
    vi.useFakeTimers()
    try {
      render(
        <InvitationsManager
          invitations={[
            {
              id: 'inv-5',
              email: 'late@example.com',
              revoked: false,
              used: false,
              expired: false,
              expiresAt: new Date(Date.now() - 1000).toISOString(),
              createdAt: new Date().toISOString()
            }
          ]}
        />
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      expect(screen.getByText('Expired')).toBeInTheDocument()
      expect(screen.queryByText('Revoke')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('creates an invitation and shows a copyable link', async () => {
    const created: InvitationView = {
      id: 'inv-3',
      email: 'new@example.com',
      revoked: false,
      used: false,
      expired: false,
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

    fireEvent.change(screen.getByPlaceholderText(/invitee/i), {
      target: { value: 'friend@example.com' }
    })
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
