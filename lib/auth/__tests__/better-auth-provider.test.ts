import type { NextRequest } from 'next/server'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAuth } from '@/lib/auth/better-auth/config'
import {
  consumeInvitation,
  createInvitation,
  hasRecentBootstrapInvitation,
  releaseInvitation,
  revokeInvitation,
  validateInvitation
} from '@/lib/auth/better-auth/invitations'
import { sendSmtpMail } from '@/lib/auth/better-auth/mailer'
import { betterAuthProvider } from '@/lib/auth/providers/better-auth'

const { mockAuth, mockSetCookie } = vi.hoisted(() => ({
  mockAuth: {
    api: {
      getSession: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOut: vi.fn(),
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn()
    }
  },
  mockSetCookie: vi.fn()
}))

vi.mock('@/lib/auth/better-auth/config', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/auth/better-auth/config')>()
  return { ...actual, getAuth: () => mockAuth }
})

vi.mock('@/lib/auth/better-auth/invitations', () => ({
  validateInvitation: vi.fn(),
  consumeInvitation: vi.fn(),
  createInvitation: vi.fn(),
  hasRecentBootstrapInvitation: vi.fn(async () => false),
  releaseInvitation: vi.fn(async () => {}),
  revokeInvitation: vi.fn(async () => true)
}))

vi.mock('@/lib/auth/better-auth/mailer', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth/better-auth/mailer')>()),
  sendSmtpMail: vi.fn()
}))

const { state } = vi.hoisted(() => ({
  state: { accounts: [] as unknown[] }
}))

vi.mock('@/lib/db', () => ({
  db: {
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined)
    })),
    select: vi.fn(() => ({
      // Awaitable (user-count queries) and chainable (.where().limit() for
      // the account-exists check) so both query shapes resolve.
      from: vi.fn(() =>
        Object.assign(Promise.resolve([{ total: 0 }]), {
          where: vi.fn(() => ({
            limit: vi.fn(async () => state.accounts)
          }))
        })
      )
    }))
  }
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ origin: 'http://localhost:3000' })),
  cookies: vi.fn(async () => ({ set: mockSetCookie }))
}))

function makeRequest(pathname: string): NextRequest {
  const href = `http://localhost:3000${pathname}`
  return {
    nextUrl: {
      href,
      pathname,
      clone: () => new URL(href)
    },
    headers: new Headers()
  } as unknown as NextRequest
}

const sessionUser = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Admin',
  image: null,
  createdAt: new Date('2026-01-01'),
  role: 'admin'
}

describe('better-auth provider', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    state.accounts = []
    for (const key of [
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'AUTH_SIGNUP_MODE',
      'BOOTSTRAP_ADMIN_EMAIL',
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

  describe('capabilities', () => {
    it('gates passwordReset on SMTP configuration', () => {
      expect(betterAuthProvider.capabilities.passwordReset).toBe(false)

      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'secret'

      // Emailed links need a canonical origin, never request headers
      expect(betterAuthProvider.capabilities.passwordReset).toBe(false)
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'

      expect(betterAuthProvider.capabilities.passwordReset).toBe(true)
      expect(betterAuthProvider.capabilities.signUp).toBe(true)
      expect(betterAuthProvider.capabilities.deleteUser).toBe(true)
      expect(betterAuthProvider.capabilities.share).toBe(true)
    })
  })

  describe('getCurrentUser', () => {
    it('resolves the session user', async () => {
      vi.mocked(mockAuth.api.getSession).mockResolvedValue({
        user: sessionUser
      } as never)

      const user = await betterAuthProvider.getCurrentUser()

      expect(user).toMatchObject({
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'admin'
      })
    })

    it('returns null without a session', async () => {
      vi.mocked(mockAuth.api.getSession).mockResolvedValue(null)

      await expect(betterAuthProvider.getCurrentUser()).resolves.toBeNull()
    })
  })

  describe('handleSession', () => {
    it('redirects unauthenticated requests to protected paths', async () => {
      vi.mocked(mockAuth.api.getSession).mockResolvedValue({
        response: null,
        headers: new Headers()
      } as never)

      const response = await betterAuthProvider.handleSession!(
        makeRequest('/some-protected-page')
      )

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/auth/login'
      )
    })

    it('lets unauthenticated requests through on public paths', async () => {
      vi.mocked(mockAuth.api.getSession).mockResolvedValue({
        response: null,
        headers: new Headers()
      } as never)

      const response = await betterAuthProvider.handleSession!(
        makeRequest('/auth/login')
      )

      expect(response.status).toBe(200)
    })

    it('lets unauthenticated analytics through the posthog relay', async () => {
      // Guest pageviews from the login and sign-up pages must reach PostHog
      // instead of bouncing to /auth/login.
      vi.mocked(mockAuth.api.getSession).mockResolvedValue({
        response: null,
        headers: new Headers()
      } as never)

      const response = await betterAuthProvider.handleSession!(
        makeRequest('/relay/e/?ip=1')
      )

      expect(response.status).toBe(200)
    })

    it('lets logged-out users open shared chat links', async () => {
      // /search/<id> is the share URL: app/search/[id]/page.tsx enforces
      // visibility (public chats viewable, private rejected), so the proxy
      // must not pre-empt that check with a login redirect.
      vi.mocked(mockAuth.api.getSession).mockResolvedValue({
        response: null,
        headers: new Headers()
      } as never)

      const response = await betterAuthProvider.handleSession!(
        makeRequest('/search/abc123')
      )

      expect(response.status).toBe(200)
    })

    it('lets authenticated requests through', async () => {
      vi.mocked(mockAuth.api.getSession).mockResolvedValue({
        response: { user: sessionUser },
        headers: new Headers()
      } as never)

      const response = await betterAuthProvider.handleSession!(
        makeRequest('/some-protected-page')
      )

      expect(response.status).toBe(200)
    })

    it('forwards refreshed session cookies to the response', async () => {
      // better-auth renews the cookie past half the session lifetime; the
      // middleware must pass it on or active users expire at the old time.
      const responseHeaders = new Headers()
      responseHeaders.append(
        'set-cookie',
        'better-auth.session_token=refreshed; Path=/; HttpOnly'
      )
      vi.mocked(mockAuth.api.getSession).mockResolvedValue({
        response: { user: sessionUser },
        headers: responseHeaders
      } as never)

      const response = await betterAuthProvider.handleSession!(
        makeRequest('/some-protected-page')
      )

      expect(response.headers.get('set-cookie')).toContain('refreshed')
    })
  })

  describe('signIn', () => {
    it('signs in and stores the session cookie', async () => {
      const responseHeaders = new Headers()
      responseHeaders.append(
        'set-cookie',
        'better-auth.session_token=token; Path=/; HttpOnly'
      )
      vi.mocked(mockAuth.api.signInEmail).mockResolvedValue({
        response: { session: {}, user: sessionUser },
        headers: responseHeaders
      } as never)

      const result = await betterAuthProvider.signIn!({
        email: 'admin@example.com',
        password: 'secret'
      })

      expect(result).toEqual({ success: true })
      expect(mockAuth.api.signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { email: 'admin@example.com', password: 'secret' }
        })
      )
      expect(mockSetCookie).toHaveBeenCalledWith(
        'better-auth.session_token',
        'token',
        expect.objectContaining({ path: '/', httpOnly: true })
      )
    })

    it('reports invalid credentials', async () => {
      vi.mocked(mockAuth.api.signInEmail).mockRejectedValue(
        new Error('Invalid email or password')
      )

      const result = await betterAuthProvider.signIn!({
        email: 'admin@example.com',
        password: 'wrong'
      })

      expect(result).toEqual({
        success: false,
        error: 'Invalid email or password'
      })
      expect(mockSetCookie).not.toHaveBeenCalled()
    })
  })

  describe('signUp', () => {
    const signUpResult = { token: 'session-token', user: sessionUser }

    it('signs up in open mode without a token', async () => {
      vi.mocked(mockAuth.api.signUpEmail).mockResolvedValue({
        response: signUpResult,
        headers: new Headers()
      } as never)

      const result = await betterAuthProvider.signUp!({
        email: 'new@example.com',
        password: 'secret'
      })

      expect(result).toEqual({ success: true })
      expect(validateInvitation).not.toHaveBeenCalled()
    })

    it('reports failure when the response carries no session token', async () => {
      // Regression: signUpEmail resolves to `{ token, user }`; a response
      // without a token means the account was not created.
      vi.mocked(mockAuth.api.signUpEmail).mockResolvedValue({
        response: { user: sessionUser },
        headers: new Headers()
      } as never)

      const result = await betterAuthProvider.signUp!({
        email: 'new@example.com',
        password: 'secret'
      })

      expect(result.success).toBe(false)
    })

    it('requires a valid invitation in invite mode', async () => {
      process.env.AUTH_SIGNUP_MODE = 'invite'
      vi.mocked(validateInvitation).mockResolvedValue(null)

      const result = await betterAuthProvider.signUp!({
        email: 'new@example.com',
        password: 'secret'
      })

      expect(result).toEqual({
        success: false,
        error: 'Sign-up requires a valid invitation token.'
      })
      expect(mockAuth.api.signUpEmail).not.toHaveBeenCalled()
    })

    it('lets the BOOTSTRAP_ADMIN_EMAIL account sign up without an invitation', async () => {
      // Fresh invite-only instance: invitations require an admin, so the
      // gated seed address must be able to create the first account.
      process.env.AUTH_SIGNUP_MODE = 'invite'
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'Admin@Corp.local'
      vi.mocked(mockAuth.api.signUpEmail).mockResolvedValue({
        response: signUpResult,
        headers: new Headers()
      } as never)

      const result = await betterAuthProvider.signUp!({
        email: 'admin@corp.local',
        password: 'secret'
      })

      expect(result).toEqual({ success: true })
      expect(validateInvitation).not.toHaveBeenCalled()
    })

    it('emails a bootstrap invitation instead of creating the gated account when SMTP is set', async () => {
      // The gate only compares caller-supplied text; with SMTP available the
      // gated address must prove mailbox control before the admin account
      // is created.
      process.env.AUTH_SIGNUP_MODE = 'invite'
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'pass'
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
      vi.mocked(createInvitation).mockResolvedValue({
        invitation: {} as never,
        token: 'boot-token'
      })

      const result = await betterAuthProvider.signUp!({
        email: 'admin@corp.local',
        password: 'secret'
      })

      expect(result.success).toBe(true)
      expect(result.notice).toContain('bootstrap link')
      expect(createInvitation).toHaveBeenCalledWith({
        invitedBy: 'bootstrap',
        email: 'admin@corp.local'
      })
      expect(sendSmtpMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@corp.local',
          text: expect.stringContaining('/auth/sign-up?token=boot-token')
        })
      )
      expect(mockAuth.api.signUpEmail).not.toHaveBeenCalled()
    })

    it('still validates the emailed bootstrap invitation through the normal token path', async () => {
      // Following the emailed link must go through invitation validation,
      // not the mailbox-proof branch (which would loop forever).
      process.env.AUTH_SIGNUP_MODE = 'invite'
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'pass'
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
      vi.mocked(validateInvitation).mockResolvedValue({
        id: 'inv-1',
        email: 'admin@corp.local'
      } as never)
      vi.mocked(consumeInvitation).mockResolvedValue(true)
      vi.mocked(mockAuth.api.signUpEmail).mockResolvedValue({
        response: signUpResult,
        headers: new Headers()
      } as never)

      const result = await betterAuthProvider.signUp!({
        email: 'admin@corp.local',
        password: 'secret',
        token: 'boot-token'
      })

      expect(result).toEqual({ success: true })
      expect(createInvitation).not.toHaveBeenCalled()
      expect(consumeInvitation).toHaveBeenCalledWith('inv-1')
    })

    it('releases the invitation when sign-up is rejected', async () => {
      // better-auth validates the password after the claim: a rejected
      // credential (e.g. below the minimum length) must not burn the link,
      // or the invitee needs a fresh invitation for a typo.
      process.env.AUTH_SIGNUP_MODE = 'invite'
      vi.mocked(validateInvitation).mockResolvedValue({
        id: 'inv-9',
        email: 'member@example.com'
      } as never)
      vi.mocked(consumeInvitation).mockResolvedValue(true)
      vi.mocked(mockAuth.api.signUpEmail).mockResolvedValue({
        response: null,
        headers: new Headers()
      } as never)

      const result = await betterAuthProvider.signUp!({
        email: 'member@example.com',
        password: 'short',
        token: 'invite-token'
      })

      expect(result.success).toBe(false)
      expect(releaseInvitation).toHaveBeenCalledWith('inv-9')
    })

    it('releases the invitation when sign-up throws', async () => {
      process.env.AUTH_SIGNUP_MODE = 'invite'
      vi.mocked(validateInvitation).mockResolvedValue({
        id: 'inv-9',
        email: 'member@example.com'
      } as never)
      vi.mocked(consumeInvitation).mockResolvedValue(true)
      vi.mocked(mockAuth.api.signUpEmail).mockRejectedValue(
        new Error('Password must be at least 8 characters')
      )

      const result = await betterAuthProvider.signUp!({
        email: 'member@example.com',
        password: 'short',
        token: 'invite-token'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('at least 8 characters')
      expect(releaseInvitation).toHaveBeenCalledWith('inv-9')
    })

    it('keeps the invitation consumed when the account exists despite a throw', async () => {
      // The throw may have happened after better-auth committed the user:
      // releasing the claim would re-enable a link whose address is taken.
      process.env.AUTH_SIGNUP_MODE = 'invite'
      state.accounts = [{ id: 'user-1' }]
      vi.mocked(validateInvitation).mockResolvedValue({
        id: 'inv-9',
        email: 'member@example.com'
      } as never)
      vi.mocked(consumeInvitation).mockResolvedValue(true)
      vi.mocked(mockAuth.api.signUpEmail).mockRejectedValue(
        new Error('connection dropped')
      )

      const result = await betterAuthProvider.signUp!({
        email: 'member@example.com',
        password: 'secret',
        token: 'invite-token'
      })

      expect(result.success).toBe(false)
      expect(releaseInvitation).not.toHaveBeenCalled()
    })

    it('rejects an arbitrary token on the gated address in open mode', async () => {
      // Open mode ignores tokens for regular sign-ups, so the bootstrap
      // proof must validate them itself: any non-empty token must not be
      // enough to skip mailbox control.
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'pass'
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
      vi.mocked(validateInvitation).mockResolvedValue(null)

      const result = await betterAuthProvider.signUp!({
        email: 'admin@corp.local',
        password: 'secret',
        token: 'arbitrary-token'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('link sent to your email')
      expect(mockAuth.api.signUpEmail).not.toHaveBeenCalled()
      expect(createInvitation).not.toHaveBeenCalled()
    })

    it('redeems the emailed bootstrap invitation in open mode too', async () => {
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'pass'
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
      vi.mocked(validateInvitation).mockResolvedValue({
        id: 'inv-2',
        email: 'admin@corp.local'
      } as never)
      vi.mocked(consumeInvitation).mockResolvedValue(true)
      vi.mocked(mockAuth.api.signUpEmail).mockResolvedValue({
        response: signUpResult,
        headers: new Headers()
      } as never)

      const result = await betterAuthProvider.signUp!({
        email: 'admin@corp.local',
        password: 'secret',
        token: 'boot-token'
      })

      expect(result).toEqual({ success: true })
      expect(consumeInvitation).toHaveBeenCalledWith('inv-2')
    })

    it('rejects a bootstrap token not bound to the gated address', async () => {
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'pass'
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
      vi.mocked(validateInvitation).mockResolvedValue({
        id: 'inv-3',
        email: null
      } as never)

      const result = await betterAuthProvider.signUp!({
        email: 'admin@corp.local',
        password: 'secret',
        token: 'unbound-token'
      })

      expect(result.success).toBe(false)
      expect(mockAuth.api.signUpEmail).not.toHaveBeenCalled()
      expect(consumeInvitation).not.toHaveBeenCalled()
    })

    it('does not send a second bootstrap link within the cooldown', async () => {
      // The branch runs before better-auth's rate limiter: a caller who
      // knows the gated address must not be able to flood the mailbox.
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'pass'
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
      vi.mocked(hasRecentBootstrapInvitation).mockResolvedValue(true)

      const result = await betterAuthProvider.signUp!({
        email: 'admin@corp.local',
        password: 'secret'
      })

      expect(result.success).toBe(true)
      expect(result.notice).toContain('bootstrap link')
      expect(createInvitation).not.toHaveBeenCalled()
      expect(sendSmtpMail).not.toHaveBeenCalled()
      expect(mockAuth.api.signUpEmail).not.toHaveBeenCalled()
    })

    it('refuses the bootstrap flow when SMTP is set without a canonical origin', async () => {
      // Fail closed: silently falling back to first-come sign-up would
      // let anyone who guesses the gated address claim admin while the
      // operator believes mailbox proof is active.
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'pass'

      const result = await betterAuthProvider.signUp!({
        email: 'admin@corp.local',
        password: 'secret'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('BETTER_AUTH_URL')
      expect(createInvitation).not.toHaveBeenCalled()
      expect(sendSmtpMail).not.toHaveBeenCalled()
      expect(mockAuth.api.signUpEmail).not.toHaveBeenCalled()
    })

    it('releases the invitation when the bootstrap email fails to send', async () => {
      // Otherwise the cooldown would treat the unsent invitation as
      // delivered and block retries for 15 minutes.
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'pass'
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
      vi.mocked(hasRecentBootstrapInvitation).mockResolvedValue(false)
      vi.mocked(createInvitation).mockResolvedValue({
        invitation: { id: 'inv-boot' } as never,
        token: 'boot-token'
      })
      vi.mocked(sendSmtpMail).mockRejectedValue(new Error('smtp down'))

      const result = await betterAuthProvider.signUp!({
        email: 'admin@corp.local',
        password: 'secret'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('smtp down')
      expect(revokeInvitation).toHaveBeenCalledWith('inv-boot')
    })

    it('serializes concurrent bootstrap requests per address', async () => {
      // The cooldown check and the insert are separate queries: without the
      // per-address lock, two concurrent calls would both pass the check
      // before either insert landed and each would mail a live admin link.
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'pass'
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
      let created = false
      vi.mocked(hasRecentBootstrapInvitation).mockImplementation(
        async () => created
      )
      vi.mocked(createInvitation).mockImplementation(async () => {
        created = true
        return { invitation: { id: 'inv-boot' } as never, token: 'boot-token' }
      })
      vi.mocked(sendSmtpMail).mockResolvedValue(undefined)

      const [first, second] = await Promise.all([
        betterAuthProvider.signUp!({
          email: 'admin@corp.local',
          password: 'secret'
        }),
        betterAuthProvider.signUp!({
          email: 'admin@corp.local',
          password: 'secret'
        })
      ])

      expect(first.success).toBe(true)
      expect(second.success).toBe(true)
      expect(createInvitation).toHaveBeenCalledTimes(1)
      expect(sendSmtpMail).toHaveBeenCalledTimes(1)
    })

    it('claims the invitation before creating the account', async () => {
      process.env.AUTH_SIGNUP_MODE = 'invite'
      vi.mocked(validateInvitation).mockResolvedValue({
        id: 'inv-1',
        token: 'tok'
      } as never)
      vi.mocked(consumeInvitation).mockResolvedValue(true)
      vi.mocked(mockAuth.api.signUpEmail).mockResolvedValue({
        response: signUpResult,
        headers: new Headers()
      } as never)

      const result = await betterAuthProvider.signUp!({
        email: 'new@example.com',
        password: 'secret',
        token: 'tok'
      })

      expect(result).toEqual({ success: true })
      expect(consumeInvitation).toHaveBeenCalledWith('inv-1')
    })

    it('rejects a sign-up whose email does not match the invitation', async () => {
      process.env.AUTH_SIGNUP_MODE = 'invite'
      vi.mocked(validateInvitation).mockResolvedValue({
        id: 'inv-1',
        email: 'friend@example.com'
      } as never)

      const result = await betterAuthProvider.signUp!({
        email: 'someone-else@example.com',
        password: 'secret',
        token: 'tok'
      })

      expect(result).toEqual({
        success: false,
        error: 'This invitation was issued for a different email address.'
      })
      // A mismatched attempt must not burn the invitation for its recipient
      expect(consumeInvitation).not.toHaveBeenCalled()
      expect(mockAuth.api.signUpEmail).not.toHaveBeenCalled()
    })

    it('accepts a case-insensitive match with the invited email', async () => {
      process.env.AUTH_SIGNUP_MODE = 'invite'
      vi.mocked(validateInvitation).mockResolvedValue({
        id: 'inv-1',
        email: 'Friend@Example.com'
      } as never)
      vi.mocked(consumeInvitation).mockResolvedValue(true)
      vi.mocked(mockAuth.api.signUpEmail).mockResolvedValue({
        response: signUpResult,
        headers: new Headers()
      } as never)

      const result = await betterAuthProvider.signUp!({
        email: 'friend@example.com',
        password: 'secret',
        token: 'tok'
      })

      expect(result).toEqual({ success: true })
    })

    it('rejects when the invitation was already claimed concurrently', async () => {
      process.env.AUTH_SIGNUP_MODE = 'invite'
      vi.mocked(validateInvitation).mockResolvedValue({
        id: 'inv-1',
        token: 'tok'
      } as never)
      vi.mocked(consumeInvitation).mockResolvedValue(false)

      const result = await betterAuthProvider.signUp!({
        email: 'new@example.com',
        password: 'secret',
        token: 'tok'
      })

      expect(result).toEqual({
        success: false,
        error: 'Sign-up requires a valid invitation token.'
      })
      expect(mockAuth.api.signUpEmail).not.toHaveBeenCalled()
    })
  })

  describe('requestPasswordReset', () => {
    it('fails without SMTP configuration', async () => {
      const result =
        await betterAuthProvider.requestPasswordReset!('admin@example.com')

      expect(result.success).toBe(false)
      expect(mockAuth.api.requestPasswordReset).not.toHaveBeenCalled()
    })

    it('sends a reset email when SMTP is configured', async () => {
      process.env.SMTP_HOST = 'smtp.example.com'
      process.env.SMTP_USER = 'user'
      process.env.SMTP_PASSWORD = 'secret'
      vi.mocked(mockAuth.api.requestPasswordReset).mockResolvedValue(
        {} as never
      )

      const result =
        await betterAuthProvider.requestPasswordReset!('admin@example.com')

      expect(result).toEqual({ success: true })
      expect(mockAuth.api.requestPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            email: 'admin@example.com',
            redirectTo: 'http://localhost:3000/auth/update-password'
          }
        })
      )
    })
  })

  describe('updatePassword', () => {
    it('routes token resets to the sign-in page', async () => {
      // A token reset changes the credential only: no session cookie is
      // issued, so landing on the app root would show the anonymous UI.
      vi.mocked(mockAuth.api.resetPassword).mockResolvedValue({} as never)

      const result = await betterAuthProvider.updatePassword!(
        'new-password',
        'reset-token'
      )

      expect(result).toEqual({
        success: true,
        redirectTo: '/auth/login'
      })
    })

    it('keeps the session-based flow on the app root', async () => {
      vi.mocked(mockAuth.api.resetPassword).mockResolvedValue({} as never)

      const result = await betterAuthProvider.updatePassword!('new-password')

      expect(result).toEqual({ success: true })
    })
  })

  describe('deleteUser', () => {
    it('deletes the auth user row', async () => {
      const { db } = await import('@/lib/db')

      const result = await betterAuthProvider.deleteUser!('user-1')

      expect(result).toEqual({ success: true })
      expect(db.delete).toHaveBeenCalled()
    })
  })
})
