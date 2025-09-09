'use client'

import { useEffect, useMemo, useState } from 'react'

import type {
  DataRelatedQuestionsPart,
  ToolPart,
  UIMessage
} from '@/lib/types/ai'
import type { DynamicToolPart } from '@/lib/types/dynamic-tools'
import { cn } from '@/lib/utils'

import { DataSection } from './data-section'
import { DynamicToolDisplay } from './dynamic-tool-display'
import { ReasoningSection } from './reasoning-section'
import { ToolSection } from './tool-section'

// Define part types used in UIMessage
type TextPart = {
  type: 'text'
  text: string
}

type ReasoningPart = {
  type: 'reasoning'
  text: string
}

// Union of all possible message parts
type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolPart
  | DynamicToolPart
  | DataRelatedQuestionsPart

// Types for process steps
type StepVariant = 'single' | 'group' | 'sub'

type BaseStep = {
  id: string
  variant: StepVariant
  type: 'reasoning' | 'tool' | 'data' | 'dynamic-tool'
  toolType?: string
  part: MessagePart
}

type ProcessStep = BaseStep & {
  variant: 'single' | 'sub'
}

type ProcessToolGroupStep = BaseStep & {
  variant: 'group'
  groupTitle: string
  steps: ProcessStep[]
}

type ProcessStepType = ProcessStep | ProcessToolGroupStep

interface ResearchProcessSectionProps {
  message: UIMessage
  messageId: string
  getIsOpen: (id: string, partType?: string, hasNextPart?: boolean) => boolean
  onOpenChange: (id: string) => void
}

// Segment type for grouping parts between text boundaries
type Segment = {
  id: string
  parts: MessagePart[]
}

// Convert message parts into segments split by text parts
function toSegments(message: UIMessage): Segment[] {
  const parts = (message.parts ?? []) as MessagePart[]
  const segments: Segment[] = []
  let current: MessagePart[] = []
  let segIndex = 0

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (p.type === 'text') {
      if (current.length) {
        segments.push({ id: `${message.id}-seg-${segIndex++}`, parts: current })
        current = []
      }
      continue
    }
    current.push(p)
  }
  if (current.length) {
    segments.push({ id: `${message.id}-seg-${segIndex++}`, parts: current })
  }
  return segments
}

// Create a reasoning step
function makeReasoningStep(
  segId: string,
  index: number,
  part: MessagePart
): ProcessStep {
  return {
    id: `${segId}-${index}`,
    variant: 'single',
    type: 'reasoning',
    part
  }
}

// Create a single tool step
function makeSingleToolStep(
  segId: string,
  index: number,
  part: MessagePart
): ProcessStep {
  const toolType = part.type.replace('tool-', '')
  return {
    id: `${segId}-${index}`,
    variant: 'single',
    type: 'tool',
    toolType,
    part
  }
}

// Create a tool group with sub-steps
function makeToolGroup(
  segId: string,
  index: number,
  toolType: string,
  groupParts: MessagePart[]
): ProcessToolGroupStep {
  return {
    id: `${segId}-${index}`,
    variant: 'group',
    type: 'tool',
    toolType,
    groupTitle: getToolGroupTitle(toolType),
    steps: groupParts.map((p, i) => ({
      id: `${segId}-${index}-${i}`,
      variant: 'sub' as const,
      type: 'tool' as const,
      toolType,
      part: p
    })),
    part: groupParts[0] // Use first part as representative
  }
}

// Create a data step
function makeDataStep(
  segId: string,
  index: number,
  part: MessagePart
): ProcessStep {
  return {
    id: `${segId}-${index}`,
    variant: 'single',
    type: 'data',
    part
  }
}

// Create a dynamic tool step
function makeDynamicToolStep(
  segId: string,
  index: number,
  part: MessagePart
): ProcessStep {
  return {
    id: `${segId}-${index}`,
    variant: 'single',
    type: 'dynamic-tool',
    part
  }
}

// Get display title for tool groups
function getToolGroupTitle(toolType: string): string {
  const titles: Record<string, string> = {
    search: 'Search',
    fetch: 'Fetch',
    todoWrite: 'Update Tasks',
    todoRead: 'Read Tasks',
    askQuestion: 'Question',
    dynamicTool: 'Tool'
  }
  return titles[toolType] || toolType
}

// Convert segments into process steps with grouping
function toProcessSteps(segment: Segment): ProcessStepType[] {
  const steps: ProcessStepType[] = []
  let i = 0

  while (i < segment.parts.length) {
    const p = segment.parts[i]

    if (p.type === 'reasoning') {
      steps.push(makeReasoningStep(segment.id, i, p))
      i++
      continue
    }

    if (p.type === 'dynamic-tool') {
      steps.push(makeDynamicToolStep(segment.id, i, p))
      i++
      continue
    }

    if (p.type.startsWith('tool-')) {
      const toolType = p.type.slice(5)
      const groupParts: MessagePart[] = [p]
      let j = i + 1

      // Collect consecutive tool parts of the same type
      while (j < segment.parts.length && segment.parts[j].type === p.type) {
        groupParts.push(segment.parts[j])
        j++
      }

      if (groupParts.length === 1) {
        steps.push(makeSingleToolStep(segment.id, i, p))
      } else {
        steps.push(makeToolGroup(segment.id, i, toolType, groupParts))
      }
      i = j
      continue
    }

    if (p.type.startsWith('data-')) {
      steps.push(makeDataStep(segment.id, i, p))
      i++
      continue
    }

    // Skip unknown part types
    i++
  }

  return steps
}

// Accordion hook for managing open/close state within tool groups
function useAccordion(
  initialOpenId?: string,
  options = { allowNoneOpen: false }
) {
  const [openId, setOpenId] = useState<string | undefined>(initialOpenId)

  const onToggle = (id: string) => {
    setOpenId(prev => {
      if (prev === id) {
        // Keep open by default unless allowNoneOpen
        return options.allowNoneOpen ? undefined : id
      }
      return id // Open new, close previous
    })
  }

  return { openId, onToggle }
}

// Rail component for visual timeline
function ProcessRail({
  isFirst,
  isLast,
  isSubStep = false
}: {
  isFirst: boolean
  isLast: boolean
  isSubStep?: boolean
}) {
  return (
    <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col items-center">
      {/* Connector line above */}
      {!isFirst && <div className="absolute top-0 w-px h-3 bg-border/50" />}

      {/* Dot */}
      <div
        className={cn(
          'mt-3 rounded-full',
          isSubStep
            ? 'h-1.5 w-1.5 bg-muted-foreground/50'
            : 'h-2 w-2 bg-muted-foreground'
        )}
      />

      {/* Connector line below */}
      {!isLast && <div className="absolute top-5 w-px bottom-0 bg-border/50" />}
    </div>
  )
}

// Render a single step or tool group
function ProcessStepRenderer({
  step,
  messageId,
  isFirst,
  isLast,
  getIsOpen,
  onOpenChange
}: {
  step: ProcessStepType
  messageId: string
  isFirst: boolean
  isLast: boolean
  getIsOpen: (id: string, partType?: string, hasNextPart?: boolean) => boolean
  onOpenChange: (id: string) => void
}) {
  const [accordionOpenId, setAccordionOpenId] = useState<string | undefined>()

  // Initialize accordion with latest sub-step open
  useEffect(() => {
    if (step.variant === 'group' && step.steps.length > 0) {
      const lastStep = step.steps[step.steps.length - 1]
      setAccordionOpenId(lastStep.id)
    }
  }, [step])

  if (step.variant === 'group') {
    // Render tool group with sub-steps
    return (
      <div className="relative pl-8">
        <ProcessRail isFirst={isFirst} isLast={isLast} />

        {/* Group header */}
        <div className="mb-2">
          <div className="text-xs font-medium text-muted-foreground">
            {step.groupTitle}
          </div>
        </div>

        {/* Sub-steps */}
        <div className="space-y-1">
          {step.steps.map((subStep, idx) => {
            const isSubFirst = idx === 0
            const isSubLast = idx === step.steps.length - 1
            const isSubOpen = accordionOpenId === subStep.id

            return (
              <div key={subStep.id} className="relative">
                {/* Sub-step rail */}
                <div className="absolute -left-4 top-0 bottom-0 w-4 flex flex-col items-center">
                  {!isSubFirst && (
                    <div className="absolute top-0 w-px h-2 bg-border/30" />
                  )}
                  <div className="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  {!isSubLast && (
                    <div className="absolute top-3.5 w-px bottom-0 bg-border/30" />
                  )}
                </div>

                {/* Sub-step content */}
                <div className="pl-4">
                  {renderPart(
                    subStep.part,
                    messageId,
                    isSubOpen,
                    () =>
                      setAccordionOpenId(isSubOpen ? undefined : subStep.id),
                    true
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Render single step
  const isOpen = getIsOpen(step.id, step.part.type)

  return (
    <div className="relative pl-8">
      <ProcessRail isFirst={isFirst} isLast={isLast} />
      {renderPart(
        step.part,
        messageId,
        isOpen,
        () => onOpenChange(step.id),
        false
      )}
    </div>
  )
}

// Render a part based on its type
function renderPart(
  part: MessagePart,
  messageId: string,
  isOpen: boolean,
  onOpenChange: () => void,
  isSubStep: boolean
): React.ReactNode {
  switch (part.type) {
    case 'reasoning':
      const reasoningPart = part as ReasoningPart
      return (
        <ReasoningSection
          content={{ reasoning: reasoningPart.text, isDone: true }}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )

    case 'tool-search':
    case 'tool-fetch':
    case 'tool-askQuestion':
    case 'tool-todoWrite':
    case 'tool-todoRead':
      return (
        <ToolSection
          tool={part as ToolPart}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          onQuerySelect={() => {}}
        />
      )

    case 'dynamic-tool':
      return <DynamicToolDisplay part={part as DynamicToolPart} />

    case 'data-relatedQuestions':
      return (
        <DataSection
          part={part as DataRelatedQuestionsPart}
          onQuerySelect={() => {}}
        />
      )

    default:
      return null
  }
}

export function ResearchProcessSection({
  message,
  messageId,
  getIsOpen,
  onOpenChange
}: ResearchProcessSectionProps) {
  // Convert message to segments and process steps
  const segments = useMemo(() => toSegments(message), [message])
  const allSteps = useMemo(
    () => segments.flatMap(segment => toProcessSteps(segment)),
    [segments]
  )

  if (allSteps.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {allSteps.map((step, index) => (
        <ProcessStepRenderer
          key={step.id}
          step={step}
          messageId={messageId}
          isFirst={index === 0}
          isLast={index === allSteps.length - 1}
          getIsOpen={getIsOpen}
          onOpenChange={onOpenChange}
        />
      ))}
    </div>
  )
}
