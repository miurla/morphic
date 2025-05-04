'use client'

import { useArtifact } from '@/components/artifact/artifact-context'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { InspectorPanel } from './inspector-panel'

export function InspectorDrawer() {
  const { state, close } = useArtifact()
  const part = state.part
  const isMobile = useMediaQuery('(max-width: 767px)')

  // Function to get the title based on part type (mirrors ArtifactPanel logic)
  const getTitle = () => {
    if (!part) return 'Artifact' // Default title
    switch (part.type) {
      case 'tool-invocation':
        return part.toolInvocation.toolName
      case 'reasoning':
        return 'Reasoning'
      case 'text':
        return 'Text'
      default:
        return 'Content'
    }
  }

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
        <DrawerTitle asChild>
          <VisuallyHidden>{getTitle()}</VisuallyHidden>
        </DrawerTitle>
        <InspectorPanel />
      </DrawerContent>
    </Drawer>
  )
}
