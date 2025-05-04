'use client'

import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { useEffect, useState } from 'react'
import { useArtifact } from './artifact-context'
import { ArtifactPanel } from './artifact-panel'

// Hook to detect mobile screen width
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

export function ArtifactDrawer() {
  const { state, close } = useArtifact()
  const isMobile = useMediaQuery('(max-width: 767px)')
  if (!isMobile) return null
  return (
    <Drawer
      open={state.isOpen}
      onOpenChange={open => {
        if (!open) close()
      }}
      modal={true}
    >
      <DrawerContent className="p-0 max-h-[90vh] md:hidden">
        <ArtifactPanel />
      </DrawerContent>
    </Drawer>
  )
}
