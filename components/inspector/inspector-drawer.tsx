'use client'

import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

import { useMediaQuery } from '@/lib/hooks/use-media-query'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'

import { useArtifact } from '@/components/artifact/artifact-context'
import { useLibrary } from '@/components/library/library-context'
import { LibraryPanel } from '@/components/library/library-panel'

import { InspectorPanel } from './inspector-panel'

export function InspectorDrawer() {
  const { state, close } = useArtifact()
  const { isOpen: libraryOpen, closeLibrary } = useLibrary()
  const part = state.part
  const isMobile = useMediaQuery('(max-width: 767px)')
  const open = state.isOpen || libraryOpen

  // Function to get the title based on part type (mirrors ArtifactPanel logic)
  const getTitle = () => {
    if (libraryOpen) return 'Library'
    if (!part) return 'Artifact' // Default title
    switch (part.type) {
      case 'tool-search':
        return 'search'
      case 'tool-fetch':
        return 'fetch'
      case 'tool-askQuestion':
        return 'askQuestion'
      case 'reasoning':
        return 'Thoughts'
      case 'text':
        return 'Text'
      default:
        return 'Content'
    }
  }

  if (!isMobile) return null

  return (
    <Drawer
      open={open}
      onOpenChange={open => {
        if (!open) {
          if (libraryOpen) {
            closeLibrary()
          } else {
            close()
          }
        }
      }}
      modal={true}
    >
      <DrawerContent className="h-[90svh] max-h-[90svh] p-0 md:hidden">
        <DrawerTitle asChild>
          <VisuallyHidden>{getTitle()}</VisuallyHidden>
        </DrawerTitle>
        <div className="min-h-0 flex-1 overflow-hidden">
          {libraryOpen ? <LibraryPanel /> : <InspectorPanel />}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
