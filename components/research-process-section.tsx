'use client'

import { useCallback, useState } from 'react'

import type { ReasoningPart } from '@ai-sdk/provider-utils'
import { UseChatHelpers } from '@ai-sdk/react'

import type { ToolPart, UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import { ReasoningSection } from './reasoning-section'
import { ToolSection } from './tool-section'

// Message part types
type TextPart = {
  type: 'text'
  text: string
}

type DataPart = {
  type: string // starts with 'data-'
  [key: string]: any
}

type MessagePart = ReasoningPart | ToolPart | TextPart | DataPart

// Type guards
function isReasoningPart(part: MessagePart): part is ReasoningPart {
  return part.type === 'reasoning'
}

function isToolPart(part: MessagePart): part is ToolPart {
  return part.type?.startsWith?.('tool-') ?? false
}

function isTextPart(part: MessagePart): part is TextPart {
  return part.type === 'text'
}

function isDataPart(part: MessagePart): part is DataPart {
  return part.type?.startsWith?.('data-') ?? false
}

type Props = {
  message: UIMessage
  messageId: string
  getIsOpen: (id: string, partType?: string, hasNextPart?: boolean) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  parts?: MessagePart[]
}

/**
 * Splits message parts into segments, where each segment contains
 * non-text parts between text parts
 * @param parts - Array of message parts to split
 * @returns Array of segments (arrays of non-text parts)
 */
function splitByText(parts: MessagePart[]): MessagePart[][] {
  const segments: MessagePart[][] = []
  let currentSegment: MessagePart[] = []

  for (const part of parts || []) {
    if (isTextPart(part)) {
      // When we hit a text part, save the current segment if it has content
      if (currentSegment.length > 0) {
        segments.push(currentSegment)
        currentSegment = []
      }
    } else {
      // Accumulate non-text parts
      currentSegment.push(part)
    }
  }

  // Don't forget the last segment
  if (currentSegment.length > 0) {
    segments.push(currentSegment)
  }

  return segments
}

/**
 * Groups consecutive tool parts of the same type together
 * @param segment - Array of message parts within a segment
 * @returns Array of grouped parts
 */
function groupConsecutiveParts(segment: MessagePart[]): MessagePart[][] {
  if (segment.length === 0) return []

  const groups: MessagePart[][] = []
  let currentIndex = 0

  while (currentIndex < segment.length) {
    const currentPart = segment[currentIndex]

    if (isToolPart(currentPart)) {
      // Group consecutive tool parts of the same type
      const toolGroup = [currentPart]
      const toolType = currentPart.type

      let nextIndex = currentIndex + 1
      while (
        nextIndex < segment.length &&
        segment[nextIndex].type === toolType
      ) {
        toolGroup.push(segment[nextIndex] as ToolPart)
        nextIndex++
      }

      groups.push(toolGroup)
      currentIndex = nextIndex
    } else {
      // Non-tool parts stay as single-item groups
      groups.push([currentPart])
      currentIndex++
    }
  }

  return groups
}

/**
 * Custom hook for managing accordion state in grouped sections
 */
function useAccordionState(onOpenChange: (id: string, open: boolean) => void) {
  const [openSectionId, setOpenSectionId] = useState<string | null>(null)

  const handleAccordionChange = useCallback(
    (id: string, open: boolean, isSingle: boolean) => {
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
    },
    [onOpenChange]
  )

  return { openSectionId, handleAccordionChange }
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

  // Filter out empty reasoning parts to avoid incorrect grouping
  const filteredParts = allParts.filter(p => !(isReasoningPart(p) && !p.text))

  const segments = partsOverride ? [filteredParts] : splitByText(filteredParts)

  // Use custom hook for accordion state management
  const { openSectionId, handleAccordionChange } =
    useAccordionState(onOpenChange)

  if (segments.length === 0 || segments.every(seg => seg.length === 0))
    return null

  // Check if there are subsequent text parts after this segment
  const hasSubsequentContent = (segmentIndex: number): boolean => {
    // Check if there are more segments after this one
    if (segmentIndex < segments.length - 1) {
      return true
    }
    // Check if there are text parts after the last segment in the original message parts
    const lastPartInSegment =
      segments[segmentIndex][segments[segmentIndex].length - 1]
    const remainingParts =
      message.parts?.slice(
        message.parts.findIndex(p => p === lastPartInSegment) + 1
      ) || []
    return remainingParts.some(p => isTextPart(p))
  }

  return (
    <div className="space-y-2">
      {segments.map((seg, sidx) => {
        const groups = groupConsecutiveParts(seg)
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
                    if (isReasoningPart(part)) {
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

                    if (isToolPart(part)) {
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

                    if (isDataPart(part)) {
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
