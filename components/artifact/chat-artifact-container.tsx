'use client'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import React from 'react'
import { useArtifact } from './artifact-context'
import { ArtifactDrawer } from './artifact-drawer'
import { ArtifactPanel } from './artifact-panel'

export function ChatArtifactContainer({
  children
}: {
  children: React.ReactNode
}) {
  const { state } = useArtifact()
  const isMobile = useMediaQuery('(max-width: 767px)') // Below md breakpoint

  return (
    <div className="flex-1 min-h-0 flex">
      {/* Desktop: Resizable panels (Do not render on mobile) */}
      {!isMobile && (
        <ResizablePanelGroup
          direction="horizontal"
          className="flex flex-1 min-w-0 h-full" // Responsive classes removed
        >
          <ResizablePanel className="min-w-0">{children}</ResizablePanel>

          {state.isOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel className="min-w-96 w-96" maxSize={50}>
                <ArtifactPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      )}

      {/* Mobile: full-width chat + drawer (Do not render on desktop) */}
      {isMobile && (
        <div className="flex-1 h-full">
          {' '}
          {/* Responsive classes removed */}
          {children}
          {/* ArtifactDrawer checks isMobile internally, no double check needed */}
          <ArtifactDrawer />
        </div>
      )}
    </div>
  )
}
