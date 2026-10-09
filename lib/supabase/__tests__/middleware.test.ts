import { NextRequest } from 'next/server'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { exchangeRecoveryCode } from '../middleware'

vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }))
vi.mock('@/lib/supabase/keys', () => ({
  getSupabasePublishableKey: vi.fn(() => 'publishable-key')
}))

import { createServerClient } from '@supabase/ssr'

describe('exchangeRecoveryCode', () => {
  const exchangeCodeForSession = vi.fn()
  let cookieOptions: {
    cookies: {
      setAll: (cookies: Array<{ name: string; value: string }>) => void
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    vi.mocked(createServerClient).mockImplementation(((
      _url: string,
      _key: string,
      options: typeof cookieOptions
    ) => {
      cookieOptions = options
      return { auth: { exchangeCodeForSession } } as never
    }) as never)
  })

  function requestWithCode() {
    return new NextRequest(
      'http://localhost:3000/auth/update-password?code=abc&state=xyz'
    )
  }

  it('persists the session and redirects to the clean URL', async () => {
    exchangeCodeForSession.mockImplementation(async () => {
      cookieOptions.cookies.setAll([{ name: 'sb-session', value: 'token' }])
      return { error: null }
    })

    const response = await exchangeRecoveryCode(requestWithCode(), 'abc')

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/update-password'
    )
    expect(response.cookies.get('sb-session')?.value).toBe('token')
  })

  it('bounces to login when the code cannot be exchanged', async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: 'invalid code' }
    })

    const response = await exchangeRecoveryCode(requestWithCode(), 'abc')

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/login'
    )
  })
})
