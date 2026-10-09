import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_ANONYMOUS_USER_ID,
  noneAuthProvider
} from '@/lib/auth/providers/none'

describe('none auth provider (anonymous mode)', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of [
      'ENABLE_AUTH',
      'ANONYMOUS_USER_ID',
      'MORPHIC_CLOUD_DEPLOYMENT',
      'NODE_ENV'
    ]) {
      original[key] = process.env[key]
    }
    delete process.env.ANONYMOUS_USER_ID
    delete process.env.MORPHIC_CLOUD_DEPLOYMENT
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    vi.restoreAllMocks()
  })

  it('resolves the shared anonymous user ID', async () => {
    await expect(noneAuthProvider.getCurrentUserId?.()).resolves.toBe(
      DEFAULT_ANONYMOUS_USER_ID
    )
  })

  it('resolves the configured anonymous user ID', async () => {
    process.env.ANONYMOUS_USER_ID = 'my-anon'
    await expect(noneAuthProvider.getCurrentUserId?.()).resolves.toBe('my-anon')
  })

  it('resolves no user profile', async () => {
    await expect(noneAuthProvider.getCurrentUser()).resolves.toBeNull()
  })

  it('warns outside tests when resolving the anonymous identity', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await noneAuthProvider.getCurrentUserId?.()

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Authentication disabled')
    )
    vi.unstubAllEnvs()
  })

  it('does not warn in tests', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await noneAuthProvider.getCurrentUserId?.()

    expect(warn).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('refuses to resolve the anonymous identity in Morphic Cloud deployments', async () => {
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'true'

    await expect(noneAuthProvider.getCurrentUserId?.()).rejects.toThrow(
      'ENABLE_AUTH=false is not allowed in MORPHIC_CLOUD_DEPLOYMENT'
    )
  })

  it('enforces no redirects in handleSession', async () => {
    const { NextRequest } = await import('next/server')
    const request = new NextRequest('http://localhost:3000/search/abc')
    const response = await noneAuthProvider.handleSession(request)
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('discloses no capabilities', () => {
    expect(noneAuthProvider.capabilities).toEqual({
      signUp: false,
      passwordReset: false,
      deleteUser: false
    })
  })
})
