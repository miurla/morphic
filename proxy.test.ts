import { NextRequest, NextResponse } from 'next/server'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updateSession } from '@/lib/supabase/middleware'

import { proxy, relayStrippedHeaders } from './proxy'

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn()
}))

const AUTH_ENV_KEYS = [
  'AUTH_PROVIDER',
  'ENABLE_AUTH',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
] as const

describe('proxy', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of AUTH_ENV_KEYS) {
      originalEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of AUTH_ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalEnv[key]
      }
    }
  })

  it('passes through in anonymous mode (ENABLE_AUTH=false)', async () => {
    process.env.ENABLE_AUTH = 'false'

    const request = new NextRequest('http://localhost:3000/search/abc')
    const response = await proxy(request)

    expect(updateSession).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-url')).toBe(
      'http://localhost:3000/search/abc'
    )
  })

  it('passes through when Supabase is not configured', async () => {
    const request = new NextRequest('http://localhost:3000/search/abc')
    const response = await proxy(request)

    expect(updateSession).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it('delegates session enforcement to updateSession when Supabase is configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_key'
    vi.mocked(updateSession).mockResolvedValue(NextResponse.next())

    const request = new NextRequest('http://localhost:3000/search/abc')
    await proxy(request)

    expect(updateSession).toHaveBeenCalledTimes(1)
  })

  it('strips credentials from PostHog relay requests', () => {
    const stripped = relayStrippedHeaders(
      new Headers({
        cookie: 'better-auth.session_token=abc',
        authorization: 'Bearer token',
        'user-agent': 'test-agent'
      })
    )

    expect(stripped.get('cookie')).toBeNull()
    expect(stripped.get('authorization')).toBeNull()
    expect(stripped.get('user-agent')).toBe('test-agent')
  })

  it('short-circuits relay requests before session handling', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_key'
    vi.mocked(updateSession).mockResolvedValue(NextResponse.next())

    const request = new NextRequest('http://localhost:3000/relay/capture')
    const response = await proxy(request)

    expect(updateSession).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })
})
