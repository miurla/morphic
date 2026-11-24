'use client'

import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

import { useMediaQuery } from '@/lib/hooks/use-media-query'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'

import { useArtifact } from '@/components/artifact/artifact-context'
import { useI18n } from '@/components/language-provider'
import { useLibrary } from '@/components/library/library-context'
import { LibraryPanel } from '@/components/library/library-panel'

import { InspectorPanel } from './inspector-panel'

export function InspectorDrawer() {
  const { t } = useI18n()

  const { state, close } = useArtifact()
  const { isOpen: libraryOpen, closeLibrary } = useLibrary()
  const part = state.part
  const isMobile = useMediaQuery('(max-width: 767px)')
  const open = state.isOpen || libraryOpen

  // Function to get the title based on part type (mirrors ArtifactPanel logic)
  const getTitle = () => {
    if (libraryOpen) return t('Library')
    if (!part) return t('Artifact') // Default title
    switch (part.type) {
      case 'tool-search':
        return t('search')
      case 'tool-fetch':
        return t('fetch')
      case 'tool-askQuestion':
        return t('askQuestion')
      case 'reasoning':
        return t('Thoughts')
      case 'text':
        return t('Text')
      case 'draft':
        return t('Draft')
      default:
        return t('Content')
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
