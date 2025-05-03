'use client'

import { useEffect, useState } from 'react'

/**
 * Custom hook to track media query matches.
 * @param query - The media query string (e.g., '(max-width: 767px)').
 * @returns boolean - True if the media query matches, false otherwise.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Ensure window is available (client-side only)
    if (typeof window === 'undefined') {
      return
    }
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)

    // Set initial state
    setMatches(mql.matches)

    // Add listener
    mql.addEventListener('change', handler)

    // Cleanup listener on unmount
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
