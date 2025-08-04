'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'

import { InspectorDrawer } from '@/components/inspector/inspector-drawer'
import { InspectorPanel } from '@/components/inspector/inspector-panel'

import { useArtifact } from './artifact-context'

const DEFAULT_WIDTH = 500
const MIN_WIDTH = 400
const MAX_WIDTH = 800
const RESIZE_OVERLAY_Z_INDEX = 9999

export function ChatArtifactContainer({
  children
}: {
  children: React.ReactNode
}) {
  const { state } = useArtifact()
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const { open, isMobile: isMobileSidebar } = useSidebar()

  // Load saved width after hydration
  useEffect(() => {
    const savedWidth = localStorage.getItem('artifactPanelWidth')
    if (savedWidth) {
      const parsedWidth = parseInt(savedWidth, 10)
      if (
        !isNaN(parsedWidth) &&
        parsedWidth >= MIN_WIDTH &&
        parsedWidth <= MAX_WIDTH
      ) {
        setWidth(parsedWidth)
      }
    }
  }, [])

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (containerRect) {
        const newWidth = containerRect.right - e.clientX
        const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))
        setWidth(clampedWidth)
        localStorage.setItem('artifactPanelWidth', clampedWidth.toString())
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  return (
    <div className="flex-1 min-h-0 h-screen flex">
      <div className="absolute p-4 z-50 transition-opacity duration-1000">
        {(!open || isMobileSidebar) && (
          <SidebarTrigger className="animate-fade-in" />
        )}
      </div>

      {/* Desktop: Independent panels like morphic-studio */}
      <div ref={containerRef} className="hidden md:flex flex-1 overflow-hidden">
        {/* Chat Panel - Independent container */}
        <div className="flex-1 flex flex-col">{children}</div>

        {/* Resize Handle */}
        {state.isOpen && state.part && (
          <div
            className={cn(
              'w-1 mx-0.5 my-6 hover:bg-border transition-colors duration-200 cursor-col-resize select-none relative',
              isResizing && 'bg-border/50'
            )}
            onMouseDown={startResize}
          >
            <div className="absolute inset-0 -left-2 -right-2" />
          </div>
        )}

        {/* Right Panel - Independent with own animation */}
        <div
          className={cn(
            'bg-background overflow-hidden',
            state.isOpen && state.part ? 'opacity-100' : 'w-0 opacity-0',
            !isResizing && 'transition-all duration-300 ease-out'
          )}
          style={{
            width: state.isOpen && state.part ? `${width}px` : '0px'
          }}
        >
          <div className="h-full" style={{ width: `${width}px` }}>
            {state.isOpen && state.part && <InspectorPanel />}
          </div>
        </div>
      </div>

      {/* Resize overlay to prevent text selection */}
      {isResizing && (
        <div
          className="fixed inset-0 cursor-col-resize select-none"
          style={{ zIndex: RESIZE_OVERLAY_Z_INDEX }}
        />
      )}

      {/* Mobile: full-width chat + drawer */}
      <div className="md:hidden flex-1 h-full">
        {children}
        <InspectorDrawer />
      </div>
    </div>
  )
}
