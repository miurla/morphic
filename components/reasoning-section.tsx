'use client'

import type { ReasoningPart } from '@ai-sdk/provider-utils'
import { Lightbulb } from 'lucide-react'

import { useArtifact } from '@/components/artifact/artifact-context'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { MarkdownMessage } from './message'

interface ReasoningContent {
  reasoning: string
  isDone: boolean
}

export interface ReasoningSectionProps {
  content: ReasoningContent
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ReasoningSection({
  content,
  isOpen,
  onOpenChange
}: ReasoningSectionProps) {
  const { open } = useArtifact()
  const reasoningHeader = (
    <button
      type="button"
      onClick={() =>
        open({ type: 'reasoning', text: content.reasoning } as ReasoningPart)
      }
      className={`inline-flex items-center gap-1 text-left text-xs leading-none text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5 ${!content.isDone ? 'animate-pulse' : ''}`}
      title="Open details"
    >
      <Lightbulb size={12} className="shrink-0" />
      <span className="whitespace-nowrap">
        {!content.isDone ? 'Thinking...' : 'Thoughts'}
      </span>
    </button>
  )

  if (!content) return <DefaultSkeleton />

  // Return null if done and reasoning text is empty
  if (content.isDone && !content.reasoning?.trim()) return null

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={reasoningHeader}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showBorder={false}
      showIcon={false}
      variant="minimal"
      showSeparator={false}
    >
      <div className="[&_p]:text-xs [&_p]:text-muted-foreground/80">
        <MarkdownMessage message={content.reasoning} />
      </div>
    </CollapsibleMessage>
  )
}
