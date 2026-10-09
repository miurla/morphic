import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createInvitationAction,
  resetMemberPasswordAction,
  revokeInvitationAction
} from '@/lib/actions/admin'
import { getAuth } from '@/lib/auth/better-auth/config'
import {
  createInvitation,
  revokeInvitation
} from '@/lib/auth/better-auth/invitations'
import { getCurrentUser } from '@/lib/auth/get-current-user'

vi.mock('@/lib/auth/get-current-user')
vi.mock('@/lib/auth/better-auth/invitations')
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: vi.fn(async () => {}) }))
  }
}))

const { mockSetUserPassword } = vi.hoisted(() => ({
  mockSetUserPassword: vi.fn()
}))

vi.mock('@/lib/auth/better-auth/config', () => ({
  getAuth: () => ({ api: { setUserPassword: mockSetUserPassword } }),
  getEmailLinkOrigin: () =>
    (process.env.BETTER_AUTH_URL ?? '').trim().replace(/\/+$/, '')
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ origin: 'http://localhost:3000' })),
  cookies: vi.fn(async () => ({ append: vi.fn() }))
}))

vi.mock('@/lib/auth/request', () => ({
  getRequestOrigin: vi.fn(async () => 'http://localhost:3000')
}))

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'admin'
}
const memberUser = {
  id: 'user-1',
  email: 'member@example.com',
  name: 'Member',
  role: 'user'
}

const invitationRecord = {
  id: 'inv-1',
  email: 'friend@example.com',
  token: 'tok123',
  invitedBy: 'admin-1',
  revokedAt: null,
  usedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date()
}

describe('admin actions', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of [
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'BETTER_AUTH_URL'
    ]) {
      originalEnv[key] = process.env[key]
      delete process.env[key]
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  describe('non-admin denial', () => {
    it('rejects unauthenticated callers', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      await expect(createInvitationAction({})).resolves.toMatchObject({
        success: false,
        error: 'Not authenticated.'
      })
      await expect(revokeInvitationAction('inv-1')).resolves.toMatchObject({
        success: false
      })
      await expect(
        resetMemberPasswordAction({ userId: 'u', newPassword: 'password123' })
      ).resolves.toMatchObject({ success: false })
    })

    it('rejects authenticated non-admins', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(memberUser)

      await expect(createInvitationAction({})).resolves.toMatchObject({
        success: false,
        error: 'Admin access required.'
      })
      await expect(revokeInvitationAction('inv-1')).resolves.toMatchObject({
        success: false,
        error: 'Admin access required.'
      })
      await expect(
        resetMemberPasswordAction({ userId: 'u', newPassword: 'password123' })
      ).resolves.toMatchObject({
        success: false,
        error: 'Admin access required.'
      })
      expect(createInvitation).not.toHaveBeenCalled()
      expect(mockSetUserPassword).not.toHaveBeenCalled()
    })
  })

  describe('createInvitationAction', () => {
    it('creates an invitation and returns a redeemable link', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser)
      vi.mocked(createInvitation).mockResolvedValue({
        invitation: invitationRecord,
        token: 'tok123'
      })

      const result = await createInvitationAction({
        email: 'friend@example.com'
      })

      expect(result.success).toBe(true)
      expect(result.link).toBe(
        'http://localhost:3000/auth/sign-up?token=tok123'
      )
      expect(result.invitation).toMatchObject({ id: 'inv-1', revoked: false })
    })

    it('rejects invitations without a valid email address', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser)

      await expect(createInvitationAction({})).resolves.toMatchObject({
        success: false,
        error: 'A valid email address is required.'
      })
      await expect(
        createInvitationAction({ email: 'not-an-email' })
      ).resolves.toMatchObject({
        success: false,
        error: 'A valid email address is required.'
      })
      expect(createInvitation).not.toHaveBeenCalled()
    })

    it('emails the invitation when SMTP is configured', async () => {
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'secret'
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
      const sendMail = vi.fn(async () => {})
      const nodemailer = await import('nodemailer')
      vi.mocked(nodemailer.default.createTransport).mockReturnValue({
        sendMail
      } as never)

      vi.mocked(getCurrentUser).mockResolvedValue(adminUser)
      vi.mocked(createInvitation).mockResolvedValue({
        invitation: invitationRecord,
        token: 'tok123'
      })

      const result = await createInvitationAction({
        email: 'friend@example.com'
      })

      expect(result.success).toBe(true)
      expect(sendMail).toHaveBeenCalled()
      // The emailed link must use the canonical origin, never request
      // headers: a spoofed Host could ship the live token to an attacker.
      expect(JSON.stringify(sendMail.mock.calls)).toContain(
        'http://localhost:3000/auth/sign-up?token=tok123'
      )
    })

    it('withholds the invitation email without a canonical origin', async () => {
      // SMTP configured but BETTER_AUTH_URL unset: the link is still
      // returned to the admin, but nothing is emailed.
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'secret'
      const sendMail = vi.fn(async () => {})
      const nodemailer = await import('nodemailer')
      vi.mocked(nodemailer.default.createTransport).mockReturnValue({
        sendMail
      } as never)

      vi.mocked(getCurrentUser).mockResolvedValue(adminUser)
      vi.mocked(createInvitation).mockResolvedValue({
        invitation: invitationRecord,
        token: 'tok123'
      })

      const result = await createInvitationAction({
        email: 'friend@example.com'
      })

      expect(result.success).toBe(true)
      expect(result.link).toContain('auth/sign-up?token=tok123')
      expect(sendMail).not.toHaveBeenCalled()
    })
  })

  describe('revokeInvitationAction', () => {
    it('revokes an invitation', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser)
      vi.mocked(revokeInvitation).mockResolvedValue(true)

      await expect(revokeInvitationAction('inv-1')).resolves.toEqual({
        success: true
      })
    })
  })

  describe('resetMemberPasswordAction', () => {
    it('sets a member password for admins', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser)

      const result = await resetMemberPasswordAction({
        userId: 'user-1',
        newPassword: 'brand-new-password'
      })

      expect(result).toEqual({ success: true })
      expect(mockSetUserPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            userId: 'user-1',
            newPassword: 'brand-new-password'
          }
        })
      )
    })

    it('rejects short passwords', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser)

      await expect(
        resetMemberPasswordAction({ userId: 'user-1', newPassword: 'short' })
      ).resolves.toMatchObject({ success: false })
      expect(mockSetUserPassword).not.toHaveBeenCalled()
    })
  })
})
