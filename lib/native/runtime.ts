/**
 * Native runtime detection.
 *
 * Detects whether the app is running inside a Capacitor WebView, as an
 * installed PWA, or in a regular browser tab. All functions are safe to
 * call on the server (SSR) and return conservative defaults.
 *
 * Usage:
 *   import { getRuntime, isCapacitor, isNative } from '@/lib/native/runtime'
 *
 * Design rules:
 * - No Capacitor plugin imports here — detection uses only ambient globals.
 * - Safe for SSR: returns 'browser' when `window` is unavailable.
 * - Deterministic: does not change between calls within the same page load.
 */

export type RuntimeKind = 'capacitor' | 'pwa' | 'browser'
export type NativePlatform = 'ios' | 'android' | 'web'

export interface RuntimeInfo {
  /** Which shell the app is running in */
  kind: RuntimeKind
  /** The native platform, or 'web' if not inside a native shell */
  platform: NativePlatform
  /** True if running inside a Capacitor WebView */
  isCapacitor: boolean
  /** True if running as an installed PWA (home screen, but not Capacitor) */
  isPWA: boolean
  /** True if running in a regular browser tab */
  isBrowser: boolean
  /** True if running in any native-like context (Capacitor or PWA) */
  isNative: boolean
}

/**
 * Detects Capacitor runtime by checking for the injected global bridge.
 * Capacitor injects `window.Capacitor` before any web code runs.
 */
function detectCapacitor(win: any): boolean {
  return (
    typeof win !== 'undefined' &&
    typeof win.Capacitor === 'object' &&
    win.Capacitor !== null &&
    typeof win.Capacitor.isNativePlatform === 'function' &&
    win.Capacitor.isNativePlatform() === true
  )
}

/**
 * Detects installed PWA via display-mode or iOS navigator.standalone.
 */
function detectPWA(win: any, nav: any): boolean {
  if (typeof win === 'undefined') return false

  // iOS Safari standalone mode
  if (nav?.standalone === true) return true

  // Standard display-mode media query
  if (typeof win.matchMedia === 'function') {
    try {
      if (win.matchMedia('(display-mode: standalone)').matches) return true
      if (win.matchMedia('(display-mode: fullscreen)').matches) return true
    } catch {
      // matchMedia can throw in restricted contexts
    }
  }

  return false
}

/**
 * Detects the native platform from Capacitor's injected global.
 */
function detectPlatform(win: any): NativePlatform {
  if (typeof win === 'undefined') return 'web'

  const cap = win.Capacitor
  if (typeof cap !== 'object' || cap === null) return 'web'

  const platform =
    typeof cap.getPlatform === 'function' ? cap.getPlatform() : undefined

  if (platform === 'ios') return 'ios'
  if (platform === 'android') return 'android'
  return 'web'
}

/** Cached result — runtime does not change within a page load */
let cached: RuntimeInfo | null = null

/**
 * Detect the current runtime environment.
 *
 * Safe to call on the server (returns browser defaults).
 * Result is cached after first call.
 */
export function getRuntime(): RuntimeInfo {
  if (cached) return cached

  const win = typeof window !== 'undefined' ? (window as any) : undefined
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : undefined

  const isCapacitorRuntime = detectCapacitor(win)
  const isPWARuntime = !isCapacitorRuntime && detectPWA(win, nav)
  const isBrowserRuntime = !isCapacitorRuntime && !isPWARuntime

  const kind: RuntimeKind = isCapacitorRuntime
    ? 'capacitor'
    : isPWARuntime
      ? 'pwa'
      : 'browser'

  const platform = detectPlatform(win)

  const result: RuntimeInfo = {
    kind,
    platform,
    isCapacitor: isCapacitorRuntime,
    isPWA: isPWARuntime,
    isBrowser: isBrowserRuntime,
    isNative: isCapacitorRuntime || isPWARuntime
  }

  cached = result
  return result
}

/**
 * Reset cached runtime (for testing only).
 */
export function _resetRuntimeCache(): void {
  cached = null
}

// Convenience re-exports
export function isCapacitor(): boolean {
  return getRuntime().isCapacitor
}

export function isPWA(): boolean {
  return getRuntime().isPWA
}

export function isNative(): boolean {
  return getRuntime().isNative
}

export function getRuntimePlatform(): NativePlatform {
  return getRuntime().platform
}
