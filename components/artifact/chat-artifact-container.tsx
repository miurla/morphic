'use client'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { cn } from '@/lib/utils'
import React, { useEffect, useState } from 'react'
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
  const [renderPanel, setRenderPanel] = useState(state.isOpen)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (state.isOpen) {
      setRenderPanel(true)
      setIsClosing(false)
    } else {
      if (renderPanel) {
        setIsClosing(true)
        timer = setTimeout(() => {
          setRenderPanel(false)
          setIsClosing(false)
        }, 200)
      }
    }
    return () => {
      clearTimeout(timer)
    }
  }, [state.isOpen, renderPanel])

  return (
    <div className="flex-1 min-h-0 h-screen flex">
      {/* Desktop: Resizable panels (Do not render on mobile) */}
      {!isMobile && (
        <ResizablePanelGroup
          direction="horizontal"
          className="flex flex-1 min-w-0 h-full" // Responsive classes removed
        >
          <ResizablePanel className="min-w-0">{children}</ResizablePanel>

          {renderPanel && (
            <>
              <ResizableHandle />
              <ResizablePanel
                className={cn('min-w-96 w-96 overflow-hidden', {
                  'animate-slide-in-right': state.isOpen && !isClosing,
                  'animate-slide-out-right': isClosing
                })}
                maxSize={50}
              >
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
