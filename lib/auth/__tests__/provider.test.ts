import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  getAuthProvider,
  isAnonymousMode,
  resolveAuthProviderName
} from '@/lib/auth/provider'

const AUTH_ENV_KEYS = [
  'AUTH_PROVIDER',
  'ENABLE_AUTH',
  'MORPHIC_CLOUD_DEPLOYMENT',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
] as const

function clearAuthEnv() {
  for (const key of AUTH_ENV_KEYS) {
    delete process.env[key]
  }
}

function configureSupabase() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_key'
}

describe('auth provider dispatch', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of AUTH_ENV_KEYS) {
      originalEnv[key] = process.env[key]
    }
    clearAuthEnv()
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

  describe('explicit AUTH_PROVIDER configuration', () => {
    it('resolves supabase', () => {
      process.env.AUTH_PROVIDER = 'supabase'
      expect(resolveAuthProviderName()).toBe('supabase')
      expect(getAuthProvider().name).toBe('supabase')
    })

    it('resolves none', () => {
      process.env.AUTH_PROVIDER = 'none'
      expect(resolveAuthProviderName()).toBe('none')
      expect(getAuthProvider().name).toBe('none')
    })

    it('trims surrounding whitespace', () => {
      process.env.AUTH_PROVIDER = '  none  '
      expect(resolveAuthProviderName()).toBe('none')
    })

    it('rejects unknown values', () => {
      process.env.AUTH_PROVIDER = 'auth0'
      expect(() => resolveAuthProviderName()).toThrow(
        'Invalid AUTH_PROVIDER "auth0"'
      )
    })

    it('accepts better-auth as a name but reports it unavailable in this version', () => {
      process.env.AUTH_PROVIDER = 'better-auth'
      expect(resolveAuthProviderName()).toBe('better-auth')
      expect(() => getAuthProvider()).toThrow(
        'AUTH_PROVIDER=better-auth is not available in this version of Morphic.'
      )
    })
  })

  describe('isAnonymousMode', () => {
    it('returns true when AUTH_PROVIDER=none and ENABLE_AUTH is unset', () => {
      process.env.AUTH_PROVIDER = 'none'
      expect(isAnonymousMode()).toBe(true)
    })

    it('returns true when AUTH_PROVIDER=none even if ENABLE_AUTH=true', () => {
      process.env.AUTH_PROVIDER = 'none'
      process.env.ENABLE_AUTH = 'true'
      expect(isAnonymousMode()).toBe(true)
    })

    it('returns true when ENABLE_AUTH=false', () => {
      process.env.ENABLE_AUTH = 'false'
      expect(isAnonymousMode()).toBe(true)
    })

    it('returns false when unset (supabase derived)', () => {
      expect(isAnonymousMode()).toBe(false)
    })
  })

  describe('backward-compatible derivation when AUTH_PROVIDER is unset', () => {
    it('derives none when ENABLE_AUTH=false', () => {
      process.env.ENABLE_AUTH = 'false'
      expect(resolveAuthProviderName()).toBe('none')
    })

    it('derives supabase when ENABLE_AUTH=true and Supabase is configured', () => {
      process.env.ENABLE_AUTH = 'true'
      configureSupabase()
      expect(resolveAuthProviderName()).toBe('supabase')
    })

    it('derives supabase when ENABLE_AUTH is unset and Supabase is configured', () => {
      configureSupabase()
      expect(resolveAuthProviderName()).toBe('supabase')
    })

    it('derives supabase when ENABLE_AUTH is unset and Supabase is not configured', () => {
      // Guest behavior: the supabase provider resolves no user when unconfigured
      expect(resolveAuthProviderName()).toBe('supabase')
    })

    it('derives supabase when ENABLE_AUTH=true and Supabase is not configured', () => {
      process.env.ENABLE_AUTH = 'true'
      expect(resolveAuthProviderName()).toBe('supabase')
    })

    it('prefers none over Supabase configuration when ENABLE_AUTH=false', () => {
      process.env.ENABLE_AUTH = 'false'
      configureSupabase()
      expect(resolveAuthProviderName()).toBe('none')
    })
  })

  describe('Morphic Cloud deployment guard', () => {
    beforeEach(() => {
      process.env.MORPHIC_CLOUD_DEPLOYMENT = 'true'
    })

    it('allows supabase', () => {
      configureSupabase()
      expect(resolveAuthProviderName()).toBe('supabase')
    })

    it('refuses derived none (ENABLE_AUTH=false) with the historical error', () => {
      process.env.ENABLE_AUTH = 'false'
      expect(() => resolveAuthProviderName()).toThrow(
        'ENABLE_AUTH=false is not allowed in MORPHIC_CLOUD_DEPLOYMENT'
      )
    })

    it('refuses explicit AUTH_PROVIDER=none', () => {
      process.env.AUTH_PROVIDER = 'none'
      expect(() => resolveAuthProviderName()).toThrow(
        'AUTH_PROVIDER=none is not allowed in MORPHIC_CLOUD_DEPLOYMENT'
      )
    })

    it('refuses AUTH_PROVIDER=better-auth', () => {
      process.env.AUTH_PROVIDER = 'better-auth'
      expect(() => resolveAuthProviderName()).toThrow(
        'AUTH_PROVIDER=better-auth is not allowed in MORPHIC_CLOUD_DEPLOYMENT'
      )
    })
  })
})

describe('supabase provider without configuration', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    delete process.env.AUTH_PROVIDER
    delete process.env.ENABLE_AUTH
  })

  it('resolves no user when Supabase is not configured', async () => {
    const provider = getAuthProvider()
    expect(provider.name).toBe('supabase')
    await expect(provider.getCurrentUser()).resolves.toBeNull()
  })

  it('passes the request through when Supabase is not configured', async () => {
    const { NextRequest } = await import('next/server')
    const provider = getAuthProvider()
    const request = new NextRequest('http://localhost:3000/search/abc')
    const response = await provider.handleSession(request)
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})
