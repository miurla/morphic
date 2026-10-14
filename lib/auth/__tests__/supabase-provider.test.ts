import { NextRequest, NextResponse } from 'next/server'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { supabaseAuthProvider } from '@/lib/auth/providers/supabase'
import { createAuthActionClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAuthActionClient: vi.fn()
}))
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn(),
  exchangeAuthCode: vi.fn()
}))
vi.mock('@/lib/supabase/keys', () => ({
  hasSupabasePublicConfig: vi.fn(() => true)
}))
vi.mock('next/headers', () => ({ headers: vi.fn() }))

import { headers } from 'next/headers'

import { exchangeAuthCode, updateSession } from '@/lib/supabase/middleware'

function request(url: string) {
  return new NextRequest(url)
}

describe('supabase provider', () => {
  const resetPasswordForEmail = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createAuthActionClient).mockResolvedValue({
      auth: { resetPasswordForEmail }
    } as never)
    vi.mocked(headers).mockResolvedValue(
      new Headers({ origin: 'http://localhost:3000' }) as never
    )
  })

  describe('requestPasswordReset', () => {
    it('keeps the legacy allowlisted recovery destination', async () => {
      resetPasswordForEmail.mockResolvedValue({ error: null })

      const result =
        await supabaseAuthProvider.requestPasswordReset!('user@example.com')

      expect(result).toEqual({ success: true })
      expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
        redirectTo: 'http://localhost:3000/auth/update-password'
      })
    })
  })

  describe('handleSession', () => {
    it('exchanges a recovery code arriving at update-password', async () => {
      const exchanged = NextResponse.redirect(
        'http://localhost:3000/auth/update-password'
      )
      vi.mocked(exchangeAuthCode).mockResolvedValue(exchanged)
      const req = request(
        'http://localhost:3000/auth/update-password?code=abc&state=xyz'
      )

      const response = await supabaseAuthProvider.handleSession!(req)

      expect(exchangeAuthCode).toHaveBeenCalledWith(req, 'abc')
      expect(updateSession).not.toHaveBeenCalled()
      expect(response).toBe(exchanged)
    })

    it('runs normal session handling without a code', async () => {
      const next = NextResponse.next()
      vi.mocked(updateSession).mockResolvedValue(next)

      const response = await supabaseAuthProvider.handleSession!(
        request('http://localhost:3000/auth/update-password')
      )

      expect(updateSession).toHaveBeenCalledOnce()
      expect(exchangeAuthCode).not.toHaveBeenCalled()
      expect(response).toBe(next)
    })

    it('exchanges a sign-up confirmation code arriving at the root', async () => {
      const exchanged = NextResponse.redirect('http://localhost:3000/')
      vi.mocked(exchangeAuthCode).mockResolvedValue(exchanged)
      const req = request('http://localhost:3000/?code=abc')

      const response = await supabaseAuthProvider.handleSession!(req)

      expect(exchangeAuthCode).toHaveBeenCalledWith(req, 'abc', '?confirmed=1')
      expect(updateSession).not.toHaveBeenCalled()
      expect(response).toBe(exchanged)
    })

    it('ignores code params on other paths', async () => {
      const next = NextResponse.next()
      vi.mocked(updateSession).mockResolvedValue(next)

      await supabaseAuthProvider.handleSession!(
        request('http://localhost:3000/auth/login?code=abc')
      )

      expect(updateSession).toHaveBeenCalledOnce()
      expect(exchangeAuthCode).not.toHaveBeenCalled()
    })
  })
})
