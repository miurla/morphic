'use client'

import { useState } from 'react'

import { UseChatHelpers } from '@ai-sdk/react'

import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import { ReasoningSection } from './reasoning-section'
import { ToolSection } from './tool-section'

type Props = {
  message: UIMessage
  messageId: string
  getIsOpen: (id: string, partType?: string, hasNextPart?: boolean) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  parts?: AnyPart[]
}

type AnyPart = any

function splitByText(parts: AnyPart[]): AnyPart[][] {
  const segments: AnyPart[][] = []
  let curr: AnyPart[] = []
  for (const p of parts || []) {
    if (p.type === 'text') {
      if (curr.length) (segments.push(curr), (curr = []))
    } else {
      curr.push(p)
    }
  }
  if (curr.length) segments.push(curr)
  return segments
}

function groupTools(segment: AnyPart[]): AnyPart[][] {
  const groups: AnyPart[][] = []
  let i = 0
  while (i < segment.length) {
    const p = segment[i]
    if (p.type?.startsWith?.('tool-')) {
      const group: AnyPart[] = [p]
      let j = i + 1
      while (j < segment.length && segment[j].type === p.type) {
        group.push(segment[j])
        j++
      }
      groups.push(group)
      i = j
    } else {
      groups.push([p])
      i += 1
    }
  }
  return groups
}

export function ResearchProcessSection({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  onQuerySelect,
  status,
  addToolResult,
  parts: partsOverride
}: Props) {
  const allParts = partsOverride ?? (message.parts || [])
  const segments = partsOverride ? [allParts] : splitByText(allParts)

  // Track which section is open within grouped sections (accordion behavior)
  const [openSectionId, setOpenSectionId] = useState<string | null>(null)

  if (segments.length === 0) return null

  // Check if there are subsequent text parts after this segment
  const hasSubsequentContent = (segmentIndex: number): boolean => {
    // Check if there are more segments after this one
    if (segmentIndex < segments.length - 1) {
      return true
    }
    // Check if there are text parts after the last segment
    const remainingParts =
      message.parts?.slice(
        message.parts.findIndex(
          p => p === segments[segmentIndex][segments[segmentIndex].length - 1]
        ) + 1
      ) || []
    return remainingParts.some(p => p.type === 'text')
  }

  // Handle accordion-style open/close for grouped sections
  const handleAccordionChange = (
    id: string,
    open: boolean,
    isSingle: boolean
  ) => {
    if (isSingle) {
      // For single sections, use the original behavior
      onOpenChange(id, open)
    } else {
      // For grouped sections, implement accordion behavior
      if (open) {
        setOpenSectionId(id)
      } else {
        setOpenSectionId(null)
      }
      // Still notify parent for tracking purposes
      onOpenChange(id, open)
    }
  }

  return (
    <div className="space-y-2">
      {segments.map((seg, sidx) => {
        const groups = groupTools(seg)
        const isSingle = groups.length === 1 && groups[0].length === 1
        const containerClass = cn(!isSingle && 'rounded-lg border bg-card')

        return (
          <div key={`${messageId}-seg-${sidx}`} className={containerClass}>
            {groups.map((grp, gidx) => {
              const isFirstGroup = gidx === 0
              const isLastGroup = gidx === groups.length - 1
              return (
                <div
                  key={`${messageId}-grp-${sidx}-${gidx}`}
                  className={cn('space-y-1')}
                >
                  {grp.map((part, pidx) => {
                    const hasNext = pidx < grp.length - 1
                    if (part.type === 'reasoning') {
                      const rid = `${messageId}-reasoning-${sidx}-${gidx}-${pidx}`
                      // Check if there's subsequent content (next part in group or next segment/text)
                      const hasSubsequent =
                        hasNext || hasSubsequentContent(sidx)
                      const isOpen = isSingle
                        ? getIsOpen(rid, 'reasoning', hasSubsequent)
                        : openSectionId === rid

                      return (
                        <ReasoningSection
                          key={rid}
                          content={{ reasoning: part.text, isDone: !hasNext }}
                          isOpen={isOpen}
                          onOpenChange={open =>
                            handleAccordionChange(rid, open, isSingle)
                          }
                          isSingle={isSingle}
                          isFirst={isFirstGroup && pidx === 0}
                          isLast={isLastGroup && pidx === grp.length - 1}
                        />
                      )
                    }

                    if (part.type?.startsWith?.('tool-')) {
                      const id = part.toolCallId
                      // Check if there's subsequent content (next part in group or next segment/text)
                      const hasSubsequent =
                        hasNext || hasSubsequentContent(sidx)
                      const isOpen = isSingle
                        ? getIsOpen(id, part.type, hasSubsequent)
                        : openSectionId === id

                      return (
                        <ToolSection
                          key={id}
                          tool={part}
                          isOpen={isOpen}
                          onOpenChange={open =>
                            handleAccordionChange(id, open, isSingle)
                          }
                          status={status}
                          addToolResult={addToolResult}
                          onQuerySelect={onQuerySelect}
                          borderless={!isSingle}
                          isFirst={isFirstGroup && pidx === 0}
                          isLast={isLastGroup && pidx === grp.length - 1}
                        />
                      )
                    }

                    if (part.type?.startsWith?.('data-')) {
                      // For now, render nothing here; existing renderer handles data parts elsewhere
                      return null
                    }

                    return null
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export default ResearchProcessSection
