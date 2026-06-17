'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Keyboard state reported by the hook.
 */
export interface KeyboardState {
  /** Whether the virtual keyboard is currently open */
  isOpen: boolean
  /** Estimated keyboard height in pixels */
  height: number
}

const DEFAULT_STATE: KeyboardState = { isOpen: false, height: 0 }

/**
 * Threshold in pixels — viewport must shrink by at least this much
 * to be considered a keyboard opening (avoids false positives from
 * browser chrome resize, e.g., address bar show/hide).
 */
const KEYBOARD_THRESHOLD = 150

/**
 * Tracks virtual keyboard open/close state via the visualViewport API.
 *
 * Safe for SSR: returns `{ isOpen: false, height: 0 }` on the server.
 * Falls back to `window.resize` when `visualViewport` is unavailable.
 */
export function useKeyboardState(): KeyboardState {
  const [state, setState] = useState<KeyboardState>(DEFAULT_STATE)
  const initialHeightRef = useRef<number>(0)

  const handleResize = useCallback(() => {
    if (typeof window === 'undefined') return

    const viewport = window.visualViewport
    const currentHeight = viewport ? viewport.height : window.innerHeight

    if (initialHeightRef.current === 0) {
      initialHeightRef.current = currentHeight
      return
    }

    const diff = initialHeightRef.current - currentHeight

    if (diff > KEYBOARD_THRESHOLD) {
      setState({ isOpen: true, height: diff })
    } else {
      setState(DEFAULT_STATE)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const viewport = window.visualViewport

    // Capture initial height
    initialHeightRef.current = viewport ? viewport.height : window.innerHeight

    if (viewport) {
      viewport.addEventListener('resize', handleResize)
      return () => viewport.removeEventListener('resize', handleResize)
    }

    // Fallback: window resize
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [handleResize])

  return state
}
