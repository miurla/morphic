import { describe, expect, it } from 'vitest'

import {
  shouldBypassServiceWorkerRequest,
  shouldCacheServiceWorkerRequest
} from './service-worker-policy'

const origin = 'https://morphic.local'

describe('service worker cache policy', () => {
  it('allows static app shell assets that are committed to the repo', () => {
    expect(
      shouldCacheServiceWorkerRequest({
        origin,
        url: `${origin}/manifest.webmanifest`
      })
    ).toBe(true)

    expect(
      shouldCacheServiceWorkerRequest({
        origin,
        url: `${origin}/icons/icon-any.svg`
      })
    ).toBe(true)

    expect(
      shouldCacheServiceWorkerRequest({
        origin,
        url: `${origin}/icons/icon-maskable.svg`
      })
    ).toBe(true)

    expect(
      shouldCacheServiceWorkerRequest({
        origin,
        url: `${origin}/_next/static/chunks/app.js`
      })
    ).toBe(true)
  })

  it('does not cache chat, auth, upload, settings, or search routes', () => {
    const privatePaths = [
      '/api/chat',
      '/api/upload',
      '/api/auth/session',
      '/api/history',
      '/auth/login',
      '/settings',
      '/search/abc123'
    ]

    for (const path of privatePaths) {
      expect(
        shouldCacheServiceWorkerRequest({
          origin,
          url: `${origin}${path}`
        })
      ).toBe(false)
      expect(
        shouldBypassServiceWorkerRequest({
          origin,
          url: `${origin}${path}`
        })
      ).toBe(true)
    }
  })

  it('rejects non-get and cross-origin requests', () => {
    expect(
      shouldCacheServiceWorkerRequest({
        method: 'POST',
        origin,
        url: `${origin}/icons/icon-any.svg`
      })
    ).toBe(false)

    expect(
      shouldCacheServiceWorkerRequest({
        origin,
        url: 'https://example.com/icons/icon-any.svg'
      })
    ).toBe(false)
  })

  it('does not cache arbitrary pages or user-generated urls', () => {
    expect(
      shouldCacheServiceWorkerRequest({
        origin,
        url: `${origin}/`
      })
    ).toBe(false)

    expect(
      shouldCacheServiceWorkerRequest({
        origin,
        url: `${origin}/some/user/page`
      })
    ).toBe(false)
  })
})
