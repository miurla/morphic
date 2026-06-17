import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetRuntimeCache, getRuntime } from './runtime'

describe('native runtime detection', () => {
  beforeEach(() => {
    _resetRuntimeCache()
  })

  afterEach(() => {
    _resetRuntimeCache()
    vi.unstubAllGlobals()
  })

  it('returns browser defaults during SSR (no window)', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('navigator', undefined)

    const runtime = getRuntime()
    expect(runtime.kind).toBe('browser')
    expect(runtime.platform).toBe('web')
    expect(runtime.isCapacitor).toBe(false)
    expect(runtime.isPWA).toBe(false)
    expect(runtime.isBrowser).toBe(true)
    expect(runtime.isNative).toBe(false)
  })

  it('detects Capacitor runtime from injected global', () => {
    vi.stubGlobal('window', {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'ios'
      },
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', { standalone: false })

    const runtime = getRuntime()
    expect(runtime.kind).toBe('capacitor')
    expect(runtime.platform).toBe('ios')
    expect(runtime.isCapacitor).toBe(true)
    expect(runtime.isPWA).toBe(false)
    expect(runtime.isNative).toBe(true)
  })

  it('detects Android Capacitor platform', () => {
    vi.stubGlobal('window', {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'android'
      },
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', {})

    const runtime = getRuntime()
    expect(runtime.platform).toBe('android')
    expect(runtime.isCapacitor).toBe(true)
  })

  it('detects PWA from display-mode standalone', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({
        matches: query === '(display-mode: standalone)'
      })
    })
    vi.stubGlobal('navigator', { standalone: false })

    const runtime = getRuntime()
    expect(runtime.kind).toBe('pwa')
    expect(runtime.isPWA).toBe(true)
    expect(runtime.isCapacitor).toBe(false)
    expect(runtime.isNative).toBe(true)
  })

  it('detects PWA from iOS navigator.standalone', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', { standalone: true })

    const runtime = getRuntime()
    expect(runtime.kind).toBe('pwa')
    expect(runtime.isPWA).toBe(true)
  })

  it('falls back to browser when no native signals present', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', { standalone: false })

    const runtime = getRuntime()
    expect(runtime.kind).toBe('browser')
    expect(runtime.isBrowser).toBe(true)
    expect(runtime.isNative).toBe(false)
  })

  it('caches result across multiple calls', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', {})

    const first = getRuntime()
    const second = getRuntime()
    expect(first).toBe(second)
  })

  it('does not treat Capacitor as present when isNativePlatform returns false', () => {
    vi.stubGlobal('window', {
      Capacitor: {
        isNativePlatform: () => false,
        getPlatform: () => 'web'
      },
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', {})

    const runtime = getRuntime()
    expect(runtime.isCapacitor).toBe(false)
    expect(runtime.kind).toBe('browser')
  })

  it('handles matchMedia throwing gracefully', () => {
    vi.stubGlobal('window', {
      matchMedia: () => {
        throw new Error('not supported')
      }
    })
    vi.stubGlobal('navigator', {})

    const runtime = getRuntime()
    expect(runtime.kind).toBe('browser')
  })
})
