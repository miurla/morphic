'use client'

import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useArtifact } from './artifact-context'
import { ArtifactPanel } from './artifact-panel'

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
