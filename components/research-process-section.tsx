'use client'

import { UseChatHelpers } from '@ai-sdk/react'

import type {
  UIDataTypes,
  UIMessage,
  UITools
} from '@/lib/types/ai'
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
      if (curr.length) segments.push(curr), (curr = [])
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

function getRailState(index: number, total: number): RailState {
  if (total <= 1) return 'single'
  if (index === 0) return 'first'
  if (index === total - 1) return 'last'
  return 'middle'
}

type RailState = 'single' | 'first' | 'middle' | 'last'

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

  if (segments.length === 0) return null

  return (
    <div className="space-y-2">
      {segments.map((seg, sidx) => {
        const groups = groupTools(seg)
        const isSingle = groups.length === 1 && groups[0].length === 1
        const containerClass = cn(
          !isSingle && 'rounded-lg border bg-card'
        )

        return (
          <div key={`${messageId}-seg-${sidx}`} className={containerClass}>
            {groups.map((grp, gidx) => {
              const isToolGroup = grp[0].type?.startsWith?.('tool-') && grp.length > 1

              return (
                <div key={`${messageId}-grp-${sidx}-${gidx}`} className={cn('space-y-1')}>
                  {grp.map((part, pidx) => {
                    const railState = getRailState(pidx, grp.length)
                    const hasNext = pidx < grp.length - 1
                    if (part.type === 'reasoning') {
                      const rid = `${messageId}-reasoning-${sidx}-${gidx}-${pidx}`
                      return (
                        <div
                          key={rid}
                          className="relative"
                        >
                          {/* rail inside content: using process variant to tighten paddings */}
                          <div className="absolute left-1.5 top-0 bottom-0 w-px bg-transparent" />
                          <ReasoningSection
                            content={{ reasoning: part.text, isDone: !hasNext }}
                            isOpen={getIsOpen(rid, 'reasoning', hasNext)}
                            onOpenChange={open => onOpenChange(rid, open)}
                            isSingle={isSingle}
                          />
                        </div>
                      )
                    }

                    if (part.type?.startsWith?.('tool-')) {
                      // Render via ToolSection but borderless
                      const id = part.toolCallId
                      return (
                        <div
                          key={id}
                          className="relative"
                        >
                          {/* Rail */}
                          {isToolGroup && (
                            <>
                              <span
                                className={cn(
                                  'absolute left-1.5 w-px bg-border/50',
                                  railState === 'single' && 'top-2 bottom-2',
                                  railState === 'first' && 'top-2 bottom-0',
                                  railState === 'middle' && 'top-0 bottom-0',
                                  railState === 'last' && 'top-0 bottom-2'
                                )}
                              />
                              <span className="absolute left-1 top-2 h-2 w-2 rounded-full bg-muted-foreground/70" />
                            </>
                          )}
                          <ToolSection
                            tool={part}
                            isOpen={getIsOpen(id, part.type, hasNext)}
                            onOpenChange={open => onOpenChange(id, open)}
                            status={status}
                            addToolResult={addToolResult}
                            onQuerySelect={onQuerySelect}
                            borderless={!isSingle}
                          />
                        </div>
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