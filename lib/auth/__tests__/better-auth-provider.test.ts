import type { NextRequest } from 'next/server'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAuth } from '@/lib/auth/better-auth/config'
import {
  consumeInvitation,
  validateInvitation
} from '@/lib/auth/better-auth/invitations'
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
  consumeInvitation: vi.fn()
}))

vi.mock('@/lib/db', () => ({
  db: {
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined)
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
    for (const key of [
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'AUTH_SIGNUP_MODE'
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

      expect(betterAuthProvider.capabilities.passwordReset).toBe(true)
      expect(betterAuthProvider.capabilities.signUp).toBe(true)
      expect(betterAuthProvider.capabilities.deleteUser).toBe(true)
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
      vi.mocked(mockAuth.api.getSession).mockResolvedValue(null)

      const response = await betterAuthProvider.handleSession!(
        makeRequest('/some-protected-page')
      )

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/auth/login'
      )
    })

    it('lets unauthenticated requests through on public paths', async () => {
      vi.mocked(mockAuth.api.getSession).mockResolvedValue(null)

      const response = await betterAuthProvider.handleSession!(
        makeRequest('/auth/login')
      )

      expect(response.status).toBe(200)
    })

    it('lets authenticated requests through', async () => {
      vi.mocked(mockAuth.api.getSession).mockResolvedValue({
        user: sessionUser
      } as never)

      const response = await betterAuthProvider.handleSession!(
        makeRequest('/some-protected-page')
      )

      expect(response.status).toBe(200)
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
    const signUpResult = { session: {}, user: sessionUser }

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

    it('consumes the invitation after a successful sign-up', async () => {
      process.env.AUTH_SIGNUP_MODE = 'invite'
      vi.mocked(validateInvitation).mockResolvedValue({
        id: 'inv-1',
        token: 'tok'
      } as never)
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

  describe('deleteUser', () => {
    it('deletes the auth user row', async () => {
      const { db } = await import('@/lib/db')

      const result = await betterAuthProvider.deleteUser!('user-1')

      expect(result).toEqual({ success: true })
      expect(db.delete).toHaveBeenCalled()
    })
  })
})
