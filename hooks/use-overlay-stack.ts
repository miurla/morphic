'use client'

import { useCallback, useEffect, useRef } from 'react'

export interface OverlayEntry {
  /** Unique identifier for this overlay instance */
  id: string
  /** Type of overlay surface */
  type: 'sheet' | 'panel' | 'dialog'
  /** Function to close this overlay */
  close: () => void
}

export interface OverlayStackAPI {
  /** Push an overlay onto the stack and add a history entry */
  push: (entry: OverlayEntry) => void
  /** Pop the topmost overlay (called by back button handler) */
  pop: () => void
  /** Peek at the topmost entry without removing it */
  peek: () => OverlayEntry | null
  /** Current number of overlays in the stack */
  size: number
}

const OVERLAY_STATE_KEY = '__morphic_overlay__'

/**
 * Manages a LIFO overlay stack that integrates with the browser History API.
 *
 * - Each overlay pushed adds one history entry via `history.pushState()`
 * - Back button (popstate) closes the topmost overlay without navigating
 * - Closing an overlay removes its corresponding history entry
 * - Repeated open/close does not accumulate extra history entries
 * - Gracefully handles orphan popstate events (no-op if stack is empty)
 */
export function useOverlayStack(): OverlayStackAPI {
  const stackRef = useRef<OverlayEntry[]>([])

  const push = useCallback((entry: OverlayEntry) => {
    stackRef.current = [...stackRef.current, entry]

    if (typeof window !== 'undefined') {
      window.history.pushState({ [OVERLAY_STATE_KEY]: entry.id }, '')
    }
  }, [])

  const pop = useCallback(() => {
    const stack = stackRef.current
    if (stack.length === 0) return

    const topmost = stack[stack.length - 1]
    stackRef.current = stack.slice(0, -1)
    topmost.close()
  }, [])

  const peek = useCallback((): OverlayEntry | null => {
    const stack = stackRef.current
    return stack.length > 0 ? stack[stack.length - 1] : null
  }, [])

  // Handle popstate (back button)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = (event: PopStateEvent) => {
      // Only handle if our stack has entries
      if (stackRef.current.length === 0) return

      // Check if this popstate corresponds to one of our overlay entries
      const state = event.state
      if (state && typeof state === 'object' && OVERLAY_STATE_KEY in state) {
        // Browser navigated back through an overlay entry — close topmost
        const topmost = stackRef.current[stackRef.current.length - 1]
        stackRef.current = stackRef.current.slice(0, -1)
        topmost.close()
      } else if (stackRef.current.length > 0) {
        // Popstate without our marker but we have overlays —
        // this can happen if user navigated before overlay was tracked.
        // Close topmost as defensive behavior.
        const topmost = stackRef.current[stackRef.current.length - 1]
        stackRef.current = stackRef.current.slice(0, -1)
        topmost.close()
        // Re-push the non-overlay history state that was popped
        if (state !== null && state !== undefined) {
          window.history.pushState(state, '')
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return {
    push,
    pop,
    peek,
    get size() {
      return stackRef.current.length
    }
  }
}

/**
 * Close an overlay and go back in history (removes the overlay's history entry).
 * Use this when programmatically closing an overlay (not via back button).
 */
export function closeOverlayWithHistory(): void {
  if (typeof window !== 'undefined') {
    window.history.back()
  }
}
