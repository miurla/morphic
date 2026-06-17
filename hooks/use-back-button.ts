'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useOverlayStack } from './use-overlay-stack'

export interface UseBackButtonOptions {
  /** Custom back handler. If provided, overrides default behavior. */
  onBack?: () => void
}

/**
 * Unifies Android hardware back, browser back, and in-app back button behavior.
 *
 * Priority:
 * 1. If overlays are open → close topmost overlay (no navigation)
 * 2. If custom `onBack` handler provided → call it
 * 3. If navigation stack depth > 1 → router.back()
 * 4. Otherwise → navigate to root route '/'
 *
 * Note: The overlay stack handling is done in `useOverlayStack`'s own
 * popstate listener, which fires before this hook's handler. This hook
 * provides the in-app back button behavior (e.g., AppNavBar leading button).
 */
export function useBackButton(options?: UseBackButtonOptions): {
  handleBack: () => void
} {
  const router = useRouter()
  const overlayStack = useOverlayStack()

  const handleBack = () => {
    // If overlays are open, close the topmost
    if (overlayStack.size > 0) {
      overlayStack.pop()
      return
    }

    // Custom handler
    if (options?.onBack) {
      options.onBack()
      return
    }

    // Check navigation depth via history length
    // history.length > 1 indicates there's a page to go back to
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  // Listen for Capacitor/Android back button via the 'backbutton' event
  // (Capacitor dispatches this on the document when hardware back is pressed)
  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleBackButton = (e: Event) => {
      e.preventDefault()
      handleBack()
    }

    document.addEventListener('backbutton', handleBackButton)
    return () => document.removeEventListener('backbutton', handleBackButton)
  })

  return { handleBack }
}
