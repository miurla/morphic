import { beforeEach, describe, expect, it, vi } from 'vitest'

import { supabaseAuthProvider } from '@/lib/auth/providers/supabase'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn() }))

import { headers } from 'next/headers'

describe('supabase provider email action links', () => {
  const resetPasswordForEmail = vi.fn()
  const exchangeCodeForSession = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({
      auth: { resetPasswordForEmail, exchangeCodeForSession }
    } as never)
    vi.mocked(headers).mockResolvedValue(
      new Headers({ origin: 'http://localhost:3000' }) as never
    )
  })

  it('points the reset email at the code-exchange callback', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null })

    const result =
      await supabaseAuthProvider.requestPasswordReset!('user@example.com')

    expect(result).toEqual({ success: true })
    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'http://localhost:3000/api/auth/confirm'
    })
  })

  it('exchanges a recovery code for a session', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const result = await supabaseAuthProvider.exchangeEmailActionCode!('abc')

    expect(result).toEqual({ success: true })
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
  })

  it('reports exchange failures', async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: 'invalid code' }
    })

    const result = await supabaseAuthProvider.exchangeEmailActionCode!('bad')

    expect(result).toEqual({ success: false, error: 'invalid code' })
  })
})
