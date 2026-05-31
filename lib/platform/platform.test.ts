import { describe, expect, it } from 'vitest'

import {
  buildPlatformInfo,
  detectPlatformKind,
  resolveDisplayMode
} from './platform'

describe('platform detection', () => {
  it('detects iPhone as iOS', () => {
    expect(
      detectPlatformKind({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
      })
    ).toBe('ios')
  })

  it('detects modern iPadOS Safari desktop user agent by touch profile', () => {
    expect(
      detectPlatformKind({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5
      })
    ).toBe('ipados')
  })

  it('detects macOS when Mac profile has no touch points', () => {
    expect(
      detectPlatformKind({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 0
      })
    ).toBe('macos')
  })

  it('prefers userAgentData platform when available', () => {
    expect(
      detectPlatformKind({
        userAgent: 'Mozilla/5.0',
        userAgentDataPlatform: 'Windows'
      })
    ).toBe('windows')
  })

  it('detects Android', () => {
    expect(
      detectPlatformKind({
        userAgent:
          'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36'
      })
    ).toBe('android')
  })

  it('falls back to unknown for missing signals', () => {
    expect(detectPlatformKind()).toBe('unknown')
  })
})

describe('platform profile resolution', () => {
  it('uses Apple-like UI for unknown fallback', () => {
    const info = buildPlatformInfo()
    expect(info.kind).toBe('unknown')
    expect(info.isAppleLike).toBe(true)
    expect(info.classes).toContain('platform-apple-like')
  })

  it('uses Apple-like UI for Linux fallback', () => {
    const info = buildPlatformInfo({ platform: 'Linux x86_64' })
    expect(info.kind).toBe('linux')
    expect(info.isAppleLike).toBe(true)
    expect(info.classes).toContain('platform-family-linux')
  })

  it('uses non-Apple alternate profile for Android', () => {
    const info = buildPlatformInfo({ userAgent: 'Mozilla/5.0 (Linux; Android 15)' })
    expect(info.family).toBe('android')
    expect(info.isAppleLike).toBe(false)
    expect(info.classes).toContain('platform-native-alt')
  })

  it('marks standalone mode from display-mode', () => {
    const info = buildPlatformInfo({ displayMode: 'standalone' })
    expect(info.isStandalone).toBe(true)
    expect(info.classes).toContain('pwa-standalone')
  })

  it('marks standalone mode from iOS navigator standalone', () => {
    const info = buildPlatformInfo({ navigatorStandalone: true })
    expect(info.isStandalone).toBe(true)
  })
})

describe('display mode detection', () => {
  it('returns the first matching display mode in priority order', () => {
    const matchMedia = (query: string) =>
      ({ matches: query === '(display-mode: standalone)' }) as MediaQueryList

    expect(resolveDisplayMode(matchMedia)).toBe('standalone')
  })

  it('returns unknown when matchMedia is unavailable', () => {
    expect(resolveDisplayMode()).toBe('unknown')
  })

  it('continues safely when a display mode query throws', () => {
    const matchMedia = (query: string) => {
      if (query.includes('window-controls-overlay')) {
        throw new Error('unsupported')
      }
      return { matches: query === '(display-mode: browser)' } as MediaQueryList
    }

    expect(resolveDisplayMode(matchMedia)).toBe('browser')
  })
})
