import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  consumeInvitation,
  createInvitation,
  hashInvitationToken,
  hasRecentBootstrapInvitation,
  revokeInvitation,
  validateInvitation
} from '@/lib/auth/better-auth/invitations'
import { db } from '@/lib/db'

const { state } = vi.hoisted(() => ({
  state: { rows: [] as unknown[] }
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(state.rows))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(state.rows))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(state.rows))
        }))
      }))
    }))
  }
}))

function activeInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    email: 'friend@example.com',
    token: 'tok',
    invitedBy: 'admin-1',
    revokedAt: null,
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    ...overrides
  }
}

describe('invitations', () => {
  beforeEach(() => {
    state.rows = []
    vi.clearAllMocks()
  })

  describe('validateInvitation', () => {
    it('returns null for a missing token', async () => {
      await expect(validateInvitation(undefined)).resolves.toBeNull()
      await expect(validateInvitation('')).resolves.toBeNull()
      expect(db.select).not.toHaveBeenCalled()
    })

    it('returns null when no active row matches (missing or revoked)', async () => {
      // Revoked tokens are filtered out by the query (isNull(revokedAt))
      state.rows = []

      await expect(validateInvitation('revoked-or-missing')).resolves.toBeNull()
    })

    it('returns the invitation when valid', async () => {
      state.rows = [activeInvitation()]

      const invitation = await validateInvitation('tok')

      expect(invitation).toMatchObject({ id: 'inv-1', token: 'tok' })
    })

    it('returns null for an expired invitation', async () => {
      state.rows = [
        activeInvitation({ expiresAt: new Date(Date.now() - 1000) })
      ]

      await expect(validateInvitation('tok')).resolves.toBeNull()
    })

    it('returns null for an already used invitation', async () => {
      state.rows = [activeInvitation({ usedAt: new Date() })]

      await expect(validateInvitation('tok')).resolves.toBeNull()
    })
  })

  describe('hashInvitationToken', () => {
    it('returns the SHA-256 hex digest of the token', () => {
      expect(hashInvitationToken('')).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      )
    })
  })

  describe('createInvitation', () => {
    it('inserts a hashed token and returns the plaintext once', async () => {
      state.rows = [activeInvitation()]

      const { invitation, token } = await createInvitation({
        invitedBy: 'admin-1',
        email: 'friend@example.com'
      })

      expect(invitation.id).toBe('inv-1')
      expect(token).toMatch(/^[0-9a-f]{48}$/)
      expect(db.insert).toHaveBeenCalled()
    })
  })

  describe('revokeInvitation', () => {
    it('reports success when a row was revoked', async () => {
      state.rows = [{ id: 'inv-1' }]
      await expect(revokeInvitation('inv-1')).resolves.toBe(true)
    })

    it('reports failure when nothing matched', async () => {
      state.rows = []
      await expect(revokeInvitation('missing')).resolves.toBe(false)
    })
  })

  describe('consumeInvitation', () => {
    it('consumes an unconsumed invitation', async () => {
      state.rows = [{ id: 'inv-1' }]
      await expect(consumeInvitation('inv-1')).resolves.toBe(true)
    })

    it('fails when already consumed', async () => {
      state.rows = []
      await expect(consumeInvitation('inv-1')).resolves.toBe(false)
    })
  })
})

describe('hasRecentBootstrapInvitation', () => {
  it('is true when a live bootstrap invitation row exists', async () => {
    state.rows = [{ id: 'inv-1' }]

    await expect(
      hasRecentBootstrapInvitation('admin@corp.local', 15 * 60 * 1000)
    ).resolves.toBe(true)
  })

  it('is false when no row matches', async () => {
    state.rows = []

    await expect(
      hasRecentBootstrapInvitation('admin@corp.local', 15 * 60 * 1000)
    ).resolves.toBe(false)
  })
})
