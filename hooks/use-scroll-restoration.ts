'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export interface UseScrollRestorationOptions {
  /** Ref to the scrollable container element */
  containerRef: React.RefObject<HTMLElement | null>
  /** Whether to defer restoration until content renders (useful for dynamic pages) */
  deferUntilReady?: boolean
  /** Max time (ms) to wait for deferred content before restoring anyway */
  timeout?: number
}

export interface ScrollRestorationResult {
  /** Current scroll offset (updated via rAF-throttled tracking) */
  scrollOffset: number
  /** Programmatically scroll to top */
  scrollToTop: () => void
}

/** LRU scroll position cache. Max 50 entries. */
const positionMap = new Map<string, number>()
const MAX_ENTRIES = 50

function setPosition(key: string, value: number): void {
  // Move to end (most recently used)
  positionMap.delete(key)
  positionMap.set(key, value)

  // Evict oldest if over limit
  if (positionMap.size > MAX_ENTRIES) {
    const oldest = positionMap.keys().next().value
    if (oldest !== undefined) positionMap.delete(oldest)
  }
}

/** Track whether this navigation was a back/forward (popstate) */
let isPopNavigation = false

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    isPopNavigation = true
  })
}

/**
 * Saves and restores scroll positions keyed by route pathname.
 *
 * - Back navigation: restores saved position (within 5px accuracy)
 * - Forward navigation: resets to top (0, 0)
 * - LRU eviction at 50 entries
 * - Deferred restoration waits for content to render (up to timeout)
 */
export function useScrollRestoration(
  options: UseScrollRestorationOptions
): ScrollRestorationResult {
  const { containerRef, deferUntilReady = false, timeout = 2000 } = options
  const pathname = usePathname()
  const scrollOffsetRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const prevPathnameRef = useRef<string | null>(null)
  const [scrollOffset, setScrollOffset] = useState(0)

  // Save position when pathname changes
  useEffect(() => {
    if (prevPathnameRef.current && prevPathnameRef.current !== pathname) {
      setPosition(prevPathnameRef.current, scrollOffsetRef.current)
    }
    prevPathnameRef.current = pathname
  }, [pathname])

  // Restore position on mount / pathname change
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (isPopNavigation) {
      // Back/forward navigation — restore
      isPopNavigation = false
      const stored = positionMap.get(pathname)

      if (stored !== undefined && stored > 0) {
        const restore = () => {
          const maxScroll = container.scrollHeight - container.clientHeight
          const target = Math.min(stored, maxScroll)
          container.scrollTo(0, target)
          scrollOffsetRef.current = target
        }

        if (deferUntilReady) {
          // Wait for content to render, then restore
          const timer = setTimeout(restore, timeout)
          const observer = new MutationObserver(() => {
            if (container.scrollHeight > container.clientHeight) {
              clearTimeout(timer)
              observer.disconnect()
              restore()
            }
          })
          observer.observe(container, { childList: true, subtree: true })
          return () => {
            clearTimeout(timer)
            observer.disconnect()
          }
        } else {
          // Immediate restore
          requestAnimationFrame(restore)
        }
      }
    } else {
      // Forward navigation — reset to top
      container.scrollTo(0, 0)
      scrollOffsetRef.current = 0
    }
  }, [pathname, containerRef, deferUntilReady, timeout])

  // Track scroll offset via rAF-throttled handler
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        ticking = true
        rafRef.current = requestAnimationFrame(() => {
          scrollOffsetRef.current = container.scrollTop
          setScrollOffset(container.scrollTop)
          ticking = false
        })
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [containerRef])

  const scrollToTop = useCallback(() => {
    const container = containerRef.current
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
      scrollOffsetRef.current = 0
    }
  }, [containerRef])

  return {
    scrollOffset,
    scrollToTop
  }
}
