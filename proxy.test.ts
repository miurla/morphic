import { NextRequest, NextResponse } from 'next/server'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { betterAuthProvider } from '@/lib/auth/providers/better-auth'
import { updateSession } from '@/lib/supabase/middleware'

import { proxy } from './proxy'

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

  describe('PostHog relay', () => {
    it('rewrites API paths straight to PostHog without credentials', async () => {
      const request = new NextRequest('http://localhost:3000/relay/e/?ip=0', {
        method: 'POST',
        headers: {
          cookie: 'sb-access-token=abc',
          authorization: 'Bearer token',
          'cf-access-jwt-assertion': 'gateway-token',
          'x-forwarded-for': '203.0.113.7',
          'user-agent': 'Mozilla/5.0 (test)'
        }
      })
      const response = await proxy(request)

      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'https://us.i.posthog.com/e/?ip=0'
      )
      const forwarded = response.headers.get('x-middleware-override-headers')
      expect(forwarded?.split(',').sort()).toEqual([
        'user-agent',
        'x-forwarded-for'
      ])
      expect(updateSession).not.toHaveBeenCalled()
    })

    it('rewrites static and array paths to the asset host', async () => {
      const response = await proxy(
        new NextRequest('http://localhost:3000/relay/static/array.js')
      )

      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'https://us-assets.i.posthog.com/static/array.js'
      )
    })

    it('rewrites in anonymous mode too', async () => {
      process.env.ENABLE_AUTH = 'false'
      const response = await proxy(
        new NextRequest('http://localhost:3000/relay/flags/?v=2')
      )

      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'https://us.i.posthog.com/flags/?v=2'
      )
    })

    it('refuses paths that resolve off the PostHog origin', async () => {
      const response = await proxy(
        new NextRequest('http://localhost:3000/relay//evil.example/x')
      )

      expect(response.status).toBe(404)
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    })

    it('refuses declared payloads above the cap', async () => {
      const response = await proxy(
        new NextRequest('http://localhost:3000/relay/e/', {
          method: 'POST',
          headers: { 'content-length': String(64 * 1024 * 1024) },
          body: '{}'
        })
      )

      expect(response.status).toBe(413)
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    })

    it('leaves /relay to the route handler under Better Auth', async () => {
      process.env.AUTH_PROVIDER = 'better-auth'
      const handleSession = vi
        .spyOn(betterAuthProvider, 'handleSession')
        .mockResolvedValue(NextResponse.next())

      const response = await proxy(
        new NextRequest('http://localhost:3000/relay/e/')
      )

      expect(handleSession).toHaveBeenCalledTimes(1)
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    })

    it('does not treat lookalike paths as the relay', async () => {
      const response = await proxy(
        new NextRequest('http://localhost:3000/relayed')
      )

      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    })
  })
})
