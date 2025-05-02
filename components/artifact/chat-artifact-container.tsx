'use client'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
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

  return (
    <div className="flex-1 min-h-0 flex">
      {/* Desktop: Resizable panels */}
      <ResizablePanelGroup
        direction="horizontal"
        className="hidden md:flex flex-1 min-w-0 h-full"
      >
        <ResizablePanel className="min-w-0">{children}</ResizablePanel>

        {state.isOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel className="min-w-0 w-96 border-l">
              <ArtifactPanel />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Mobile: full-width chat + drawer */}
      <div className="flex-1 md:hidden h-full">
        {children}
        <ArtifactDrawer />
      </div>
    </div>
  )
}
