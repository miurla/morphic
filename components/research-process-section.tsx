'use client'

import { useCallback, useState } from 'react'

import type { ReasoningPart } from '@ai-sdk/provider-utils'
import { UseChatHelpers } from '@ai-sdk/react'

import type {
  DataPart as UIDataPart,
  ToolPart,
  UIDataTypes,
  UIMessage,
  UITools
} from '@/lib/types/ai'
import type { DynamicToolPart } from '@/lib/types/dynamic-tools'
import { cn } from '@/lib/utils'

import { DataSection } from './data-section'
import { ReasoningSection } from './reasoning-section'
import { ToolSection } from './tool-section'

// Message part types
type TextPart = {
  type: 'text'
  text: string
}

type DataPart = UIDataPart

type MessagePart =
  | ReasoningPart
  | ToolPart
  | TextPart
  | DataPart
  | DynamicToolPart

// Type guards
function isReasoningPart(part: MessagePart): part is ReasoningPart {
  return part.type === 'reasoning'
}

function isToolPart(part: MessagePart): part is ToolPart {
  return (
    (part.type?.startsWith?.('tool-') && part.type !== 'dynamic-tool') ?? false
  )
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

/**
 * Renders a single part (reasoning, tool, or data)
 */
function RenderPart({
  part,
  partId,
  hasNext,
  hasSubsequentContent,
  isSingle,
  isFirstGroup,
  isLastGroup,
  groupLength,
  partIndex,
  getIsOpen,
  openSectionId,
  handleAccordionChange,
  status,
  addToolResult,
  onQuerySelect
}: {
  part: MessagePart
  partId: string
  hasNext: boolean
  hasSubsequentContent: boolean
  isSingle: boolean
  isFirstGroup: boolean
  isLastGroup: boolean
  groupLength: number
  partIndex: number
  getIsOpen: (id: string, partType?: string, hasNextPart?: boolean) => boolean
  openSectionId: string | null
  handleAccordionChange: (id: string, open: boolean, isSingle: boolean) => void
  status?: any
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  onQuerySelect: (query: string) => void
}) {
  const hasSubsequent = hasNext || hasSubsequentContent

  if (isReasoningPart(part)) {
    const isOpen = isSingle
      ? getIsOpen(partId, 'reasoning', hasSubsequent)
      : openSectionId === partId

    return (
      <ReasoningSection
        content={{ reasoning: part.text, isDone: !hasNext }}
        isOpen={isOpen}
        onOpenChange={open => handleAccordionChange(partId, open, isSingle)}
        isSingle={isSingle}
        isFirst={isFirstGroup && partIndex === 0}
        isLast={isLastGroup && partIndex === groupLength - 1}
      />
    )
  }

  if (isToolPart(part)) {
    const isOpen = isSingle
      ? getIsOpen(part.toolCallId, part.type, hasSubsequent)
      : openSectionId === part.toolCallId

    return (
      <ToolSection
        tool={part}
        isOpen={isOpen}
        onOpenChange={open =>
          handleAccordionChange(part.toolCallId, open, isSingle)
        }
        status={status}
        addToolResult={addToolResult}
        onQuerySelect={onQuerySelect}
        borderless={!isSingle}
        isFirst={isFirstGroup && partIndex === 0}
        isLast={isLastGroup && partIndex === groupLength - 1}
      />
    )
  }

  if (isDataPart(part)) {
    return <DataSection part={part} onQuerySelect={onQuerySelect} />
  }

  return null
}

/**
 * Determines if there's content after a given segment
 * @param segmentIndex - The index of the current segment
 * @param segments - All segments
 * @param messageParts - Original message parts
 * @returns true if there's subsequent content
 */
function useHasSubsequentContent(
  segments: MessagePart[][],
  messageParts: MessagePart[] | undefined
) {
  return useCallback(
    (segmentIndex: number): boolean => {
      // Check if there are more segments after this one
      if (segmentIndex < segments.length - 1) {
        return true
      }

      // Check if there are text parts after the last segment in the original message parts
      const lastSegment = segments[segmentIndex]
      if (!lastSegment || lastSegment.length === 0) {
        return false
      }

      const lastPartInSegment = lastSegment[lastSegment.length - 1]
      const remainingParts =
        messageParts?.slice(
          messageParts.findIndex(p => p === lastPartInSegment) + 1
        ) || []

      return remainingParts.some(p => isTextPart(p))
    },
    [segments, messageParts]
  )
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
  const allParts = (partsOverride ?? (message.parts || [])) as MessagePart[]

  // Filter out empty reasoning parts to avoid incorrect grouping
  const filteredParts = allParts.filter(p => !(isReasoningPart(p) && !p.text))

  const segments = partsOverride ? [filteredParts] : splitByText(filteredParts)

  // Use custom hook for accordion state management
  const { openSectionId, handleAccordionChange } =
    useAccordionState(onOpenChange)

  // Use custom hook for subsequent content detection
  const hasSubsequentContent = useHasSubsequentContent(
    segments,
    message.parts as MessagePart[] | undefined
  )

  if (segments.length === 0 || segments.every(seg => seg.length === 0))
    return null

  return (
    <div className="space-y-2">
      {segments.map((seg, sidx) => {
        const groups = groupConsecutiveParts(seg)
        const isSingle = groups.length === 1 && groups[0].length === 1
        const containerClass = cn(!isSingle && 'rounded-lg border bg-card')

        return (
          <div key={`${messageId}-seg-${sidx}`} className={containerClass}>
            {groups.map((grp, gidx) => (
              <div key={`${messageId}-grp-${sidx}-${gidx}`}>
                {grp.map((part, pidx) => {
                  const partId = isToolPart(part)
                    ? part.toolCallId
                    : `${messageId}-${part.type}-${sidx}-${gidx}-${pidx}`

                  return (
                    <RenderPart
                      key={partId}
                      part={part}
                      partId={partId}
                      hasNext={pidx < grp.length - 1}
                      hasSubsequentContent={hasSubsequentContent(sidx)}
                      isSingle={isSingle}
                      isFirstGroup={gidx === 0}
                      isLastGroup={gidx === groups.length - 1}
                      groupLength={grp.length}
                      partIndex={pidx}
                      getIsOpen={getIsOpen}
                      openSectionId={openSectionId}
                      handleAccordionChange={handleAccordionChange}
                      status={status}
                      addToolResult={addToolResult}
                      onQuerySelect={onQuerySelect}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default ResearchProcessSection
