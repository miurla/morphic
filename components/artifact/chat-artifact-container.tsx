'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { useHasUser } from '@/lib/contexts/user-context'
import { cn } from '@/lib/utils'

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'

import { InspectorDrawer } from '@/components/inspector/inspector-drawer'
import { InspectorPanel } from '@/components/inspector/inspector-panel'

import { useArtifact } from './artifact-context'

const DEFAULT_WIDTH = 500
const MIN_WIDTH = 320
const MAX_WIDTH = 800
const CHAT_MIN_WIDTH = 360
const RESIZE_OVERLAY_Z_INDEX = 9999

// Helper function to calculate allowed width bounds
function getAllowedWidthBounds(containerWidth: number): {
  allowedMin: number
  allowedMax: number
} {
  const available = Math.max(0, containerWidth - CHAT_MIN_WIDTH)
  const allowedMax = Math.min(MAX_WIDTH, available)

  // If there's no space available, hide the panel entirely
  if (allowedMax === 0) {
    return { allowedMin: 0, allowedMax: 0 }
  }

  // Ensure minimum width doesn't exceed available space
  const allowedMin = Math.min(MIN_WIDTH, allowedMax)
  return { allowedMin, allowedMax }
}

export function ChatArtifactContainer({
  children
}: {
  children: React.ReactNode
}) {
  const { state } = useArtifact()
  const [containerElement, setContainerElement] =
    useState<HTMLDivElement | null>(null)
  const hasAppliedSavedWidthRef = useRef(false)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const hasUser = useHasUser()
  const { open, isMobile: isMobileSidebar } = useSidebar()

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node)

    if (!node || hasAppliedSavedWidthRef.current) {
      return
    }

    hasAppliedSavedWidthRef.current = true

    const savedWidth = localStorage.getItem('artifactPanelWidth')
    if (!savedWidth) {
      return
    }

    const parsedWidth = parseInt(savedWidth, 10)
    if (
      isNaN(parsedWidth) ||
      parsedWidth < MIN_WIDTH ||
      parsedWidth > MAX_WIDTH
    ) {
      return
    }

    const { allowedMin, allowedMax } = getAllowedWidthBounds(node.clientWidth)
    const clampedWidth = Math.min(Math.max(parsedWidth, allowedMin), allowedMax)
    setWidth(clampedWidth)
  }, [])

  // Keep width in bounds when container resizes (e.g., window resize)
  useEffect(() => {
    if (!containerElement) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { allowedMin, allowedMax } = getAllowedWidthBounds(
          entry.contentRect.width
        )
        setWidth(prev => Math.min(Math.max(prev, allowedMin), allowedMax))
      }
    })
    ro.observe(containerElement)
    return () => ro.disconnect()
  }, [containerElement])

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const containerRect = containerElement?.getBoundingClientRect()
      if (containerRect) {
        const newWidth = containerRect.right - e.clientX
        const { allowedMin, allowedMax } = getAllowedWidthBounds(
          containerRect.width
        )
        const clampedWidth = Math.min(
          Math.max(newWidth, allowedMin),
          allowedMax
        )
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
  }, [containerElement, isResizing])

  return (
    <div className="flex-1 min-h-0 min-w-0 h-screen flex">
      <div className="absolute p-4 z-50 transition-opacity duration-1000">
        {hasUser && (!open || isMobileSidebar) && (
          <SidebarTrigger className="animate-fade-in" />
        )}
      </div>

      {/* Desktop: Independent panels like morphic-studio */}
      <div
        ref={setContainerRef}
        className="hidden md:flex flex-1 min-w-0 overflow-hidden"
      >
        {/* Chat Panel - Independent container */}
        <div className="flex-1 min-w-0 flex flex-col">{children}</div>

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
      <div className="md:hidden flex-1 h-full min-w-0">
        {children}
        <InspectorDrawer />
      </div>
    </div>
  )
}
