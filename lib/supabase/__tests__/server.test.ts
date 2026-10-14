import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn(() => ({})) }))
vi.mock('@/lib/supabase/keys', () => ({
  getSupabasePublishableKey: vi.fn(() => 'sb_publishable_test')
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
  headers: vi.fn()
}))

import { headers } from 'next/headers'

import { createServerClient } from '@supabase/ssr'

import { createAuthActionClient } from '../server'

const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_FORWARD_CLIENT_IP',
  'VERCEL',
  'VERCEL_ENV'
] as const

function lastClientArgs() {
  const calls = vi.mocked(createServerClient).mock.calls
  return calls[calls.length - 1] as unknown as [
    string,
    string,
    { global?: { headers?: Record<string, string> } }
  ]
}

describe('createAuthActionClient', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of ENV_KEYS) saved[key] = process.env[key]
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_test'
    delete process.env.SUPABASE_FORWARD_CLIENT_IP
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'
    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }) as never
    )
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it('forwards the first x-forwarded-for address with the secret key on Vercel', async () => {
    await createAuthActionClient()

    const [, key, options] = lastClientArgs()
    expect(key).toBe('sb_secret_test')
    expect(options.global?.headers).toEqual({
      'sb-forwarded-for': '203.0.113.7'
    })
  })

  it('does not trust x-forwarded-for outside Vercel unless opted in', async () => {
    delete process.env.VERCEL

    await createAuthActionClient()

    const [, key, options] = lastClientArgs()
    expect(key).toBe('sb_publishable_test')
    expect(options.global).toBeUndefined()
  })

  it('does not trust x-forwarded-for under vercel dev', async () => {
    process.env.VERCEL_ENV = 'development'

    await createAuthActionClient()

    expect(lastClientArgs()[1]).toBe('sb_publishable_test')
  })

  it('forwards outside Vercel when SUPABASE_FORWARD_CLIENT_IP=true', async () => {
    delete process.env.VERCEL
    process.env.SUPABASE_FORWARD_CLIENT_IP = 'true'

    await createAuthActionClient()

    expect(lastClientArgs()[2].global?.headers).toEqual({
      'sb-forwarded-for': '203.0.113.7'
    })
  })

  it('can be turned off on Vercel with SUPABASE_FORWARD_CLIENT_IP=false', async () => {
    process.env.SUPABASE_FORWARD_CLIENT_IP = 'false'

    await createAuthActionClient()

    expect(lastClientArgs()[1]).toBe('sb_publishable_test')
  })

  it('falls back to the publishable key for legacy service_role keys', async () => {
    process.env.SUPABASE_SECRET_KEY = 'eyJhbGciOiJIUzI1NiJ9.legacy'

    await createAuthActionClient()

    expect(lastClientArgs()[1]).toBe('sb_publishable_test')
  })

  it('falls back when the forwarded address is not an IP', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-forwarded-for': 'unknown' }) as never
    )

    await createAuthActionClient()

    expect(lastClientArgs()[1]).toBe('sb_publishable_test')
  })
})
