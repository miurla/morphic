/**
 * Haptic feedback abstraction with safe browser fallback.
 *
 * On Capacitor (native): uses the Capacitor Haptics plugin if available.
 * On web: uses navigator.vibrate() if available, otherwise no-ops silently.
 *
 * Usage:
 *   import { hapticLight, hapticMedium, hapticHeavy, hapticSelection } from '@/lib/native/haptics'
 *   hapticLight() // fire-and-forget, never throws
 *
 * Design rules:
 * - Every function is fire-and-forget (returns void, never throws).
 * - Safe for SSR: no-ops when navigator is unavailable.
 * - No direct Capacitor plugin imports — uses global plugin bridge for tree-shaking.
 * - Respects user preferences: disabled when prefers-reduced-motion is active.
 */

import { getRuntime } from './runtime'

type HapticStyle = 'light' | 'medium' | 'heavy'

/**
 * Check if user has prefers-reduced-motion enabled.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Web fallback using navigator.vibrate().
 * Duration in ms varies by intensity.
 */
function vibrateWeb(style: HapticStyle): void {
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate !== 'function') return

  const durations: Record<HapticStyle, number> = {
    light: 10,
    medium: 20,
    heavy: 40
  }

  try {
    navigator.vibrate(durations[style])
  } catch {
    // vibrate can throw in restricted contexts
  }
}

/**
 * Access Capacitor Haptics through the registered plugin bridge.
 * Capacitor plugins register themselves on the global Capacitor object.
 * This avoids static import analysis issues when the plugin isn't installed.
 */
function getCapacitorHapticsPlugin(): any | null {
  if (typeof window === 'undefined') return null
  const cap = (window as any).Capacitor
  if (!cap || typeof cap.Plugins !== 'object') return null
  return cap.Plugins.Haptics ?? null
}

/**
 * Attempt Capacitor Haptics plugin via global bridge.
 * Returns false if plugin is not available.
 */
async function triggerCapacitorHaptics(style: HapticStyle): Promise<boolean> {
  try {
    const haptics = getCapacitorHapticsPlugin()
    if (!haptics) return false

    const styleMap: Record<HapticStyle, string> = {
      light: 'LIGHT',
      medium: 'MEDIUM',
      heavy: 'HEAVY'
    }
    await haptics.impact({ style: styleMap[style] })
    return true
  } catch {
    return false
  }
}

/**
 * Attempt Capacitor selection haptic.
 */
async function triggerCapacitorSelection(): Promise<boolean> {
  try {
    const haptics = getCapacitorHapticsPlugin()
    if (!haptics) return false

    await haptics.selectionChanged()
    return true
  } catch {
    return false
  }
}

/**
 * Core haptic trigger — handles runtime detection and fallback.
 */
async function triggerHaptic(style: HapticStyle): Promise<void> {
  if (prefersReducedMotion()) return

  const runtime = getRuntime()

  if (runtime.isCapacitor) {
    const success = await triggerCapacitorHaptics(style)
    if (success) return
  }

  // Web fallback
  vibrateWeb(style)
}

/**
 * Light haptic — for subtle UI confirmations (toggle, checkbox).
 */
export function hapticLight(): void {
  void triggerHaptic('light')
}

/**
 * Medium haptic — for standard actions (button press, selection change).
 */
export function hapticMedium(): void {
  void triggerHaptic('medium')
}

/**
 * Heavy haptic — for significant actions (destructive action, error).
 */
export function hapticHeavy(): void {
  void triggerHaptic('heavy')
}

/**
 * Selection haptic — for continuous feedback during gestures (drag, slider).
 */
export function hapticSelection(): void {
  if (prefersReducedMotion()) return

  const runtime = getRuntime()

  if (runtime.isCapacitor) {
    void triggerCapacitorSelection().then(success => {
      if (!success) vibrateWeb('light')
    })
    return
  }

  vibrateWeb('light')
}
