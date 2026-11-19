'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'

// The chat is mounted twice (desktop and mobile layouts, one hidden by CSS).
// Only the visible copy runs the space switcher, so pointer handling, keys
// and view transition names exist once.
type Surface = 'desktop' | 'mobile'

const SurfaceContext = createContext<Surface | null>(null)

const DESKTOP_QUERY = '(min-width: 48rem)'

function matchesDesktop(): boolean {
  return typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia(DESKTOP_QUERY).matches
}

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function SpaceSurface({
  surface,
  children
}: {
  surface: Surface
  children: React.ReactNode
}) {
  return (
    <SurfaceContext.Provider value={surface}>
      {children}
    </SurfaceContext.Provider>
  )
}

export function useIsVisibleSurface(): boolean {
  const surface = useContext(SurfaceContext)
  const isDesktop = useSyncExternalStore(subscribe, matchesDesktop, () => true)
  if (!surface) return true
  return surface === 'desktop' ? isDesktop : !isDesktop
}
