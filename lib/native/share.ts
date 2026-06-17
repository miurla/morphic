/**
 * Native share abstraction with safe browser fallback.
 *
 * On Capacitor (native): uses the Capacitor Share plugin.
 * On web: uses the Web Share API (navigator.share) if available.
 * Fallback: copies text to clipboard.
 *
 * Usage:
 *   import { nativeShare, canShare } from '@/lib/native/share'
 *   const result = await nativeShare({ title: 'Check this out', url: 'https://...' })
 *
 * Design rules:
 * - Never throws — always returns a result object.
 * - Safe for SSR: returns { shared: false, method: 'none' }.
 * - No direct Capacitor plugin imports in components — this module handles it.
 */

import { getRuntime } from './runtime'

export interface ShareData {
  title?: string
  text?: string
  url?: string
}

export interface ShareResult {
  /** Whether the share action completed (user may still cancel) */
  shared: boolean
  /** Which method was used */
  method: 'capacitor' | 'web-share' | 'clipboard' | 'none'
}

/**
 * Check if sharing is available in the current runtime.
 */
export function canShare(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof navigator === 'undefined') return false

  const runtime = getRuntime()
  if (runtime.isCapacitor && getCapacitorSharePlugin()) return true
  if (typeof navigator.share === 'function') return true
  if (typeof navigator.clipboard?.writeText === 'function') return true

  return false
}

/**
 * Build share text from data for clipboard fallback.
 */
function buildShareText(data: ShareData): string {
  const parts: string[] = []
  if (data.title) parts.push(data.title)
  if (data.text) parts.push(data.text)
  if (data.url) parts.push(data.url)
  return parts.join('\n')
}

/**
 * Access Capacitor Share through the registered plugin bridge.
 * Avoids static import analysis issues when plugin isn't installed.
 */
function getCapacitorSharePlugin(): any | null {
  if (typeof window === 'undefined') return null
  const cap = (window as any).Capacitor
  if (!cap || typeof cap.Plugins !== 'object') return null
  return cap.Plugins.Share ?? null
}

/**
 * Attempt Capacitor Share plugin.
 */
async function shareViaCapacitor(data: ShareData): Promise<ShareResult> {
  const share = getCapacitorSharePlugin()
  if (!share) return { shared: false, method: 'none' }

  try {
    await share.share({
      title: data.title,
      text: data.text,
      url: data.url,
      dialogTitle: data.title
    })
    return { shared: true, method: 'capacitor' }
  } catch {
    // User cancelled or non-fatal error — do not fall through to clipboard
    return { shared: false, method: 'capacitor' }
  }
}

/**
 * Attempt Web Share API.
 */
async function shareViaWebAPI(data: ShareData): Promise<ShareResult> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function'
  ) {
    return { shared: false, method: 'none' }
  }

  try {
    await navigator.share({
      title: data.title,
      text: data.text,
      url: data.url
    })
    return { shared: true, method: 'web-share' }
  } catch (err: any) {
    // AbortError means user cancelled — that's not a failure
    if (err?.name === 'AbortError') {
      return { shared: false, method: 'web-share' }
    }
    return { shared: false, method: 'none' }
  }
}

/**
 * Fallback: copy to clipboard.
 */
async function shareViaClipboard(data: ShareData): Promise<ShareResult> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.clipboard?.writeText !== 'function'
  ) {
    return { shared: false, method: 'none' }
  }

  try {
    await navigator.clipboard.writeText(buildShareText(data))
    return { shared: true, method: 'clipboard' }
  } catch {
    return { shared: false, method: 'none' }
  }
}

/**
 * Share content using the best available method for the current runtime.
 *
 * Priority:
 * 1. Capacitor Share plugin (native)
 * 2. Web Share API (mobile browsers, some desktop)
 * 3. Clipboard copy (fallback)
 */
export async function nativeShare(data: ShareData): Promise<ShareResult> {
  if (typeof window === 'undefined') {
    return { shared: false, method: 'none' }
  }

  const runtime = getRuntime()

  // Try Capacitor first
  if (runtime.isCapacitor) {
    const result = await shareViaCapacitor(data)
    if (result.shared || result.method === 'capacitor') return result
  }

  // Try Web Share API
  const webResult = await shareViaWebAPI(data)
  if (webResult.shared || webResult.method === 'web-share') return webResult

  // Fallback to clipboard
  return shareViaClipboard(data)
}
