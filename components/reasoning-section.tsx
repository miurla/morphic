'use client'

import type { ReasoningPart } from '@ai-sdk/provider-utils'
import { Lightbulb, Loader2 } from 'lucide-react'

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
      className="flex items-center gap-1 w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      title="Open details"
    >
      <Lightbulb size={14} />
      <span>{!content.isDone ? 'Thinking...' : 'Thoughts'}</span>
      {!content.isDone && (
        <Loader2
          size={14}
          className="animate-spin text-muted-foreground/50 ml-auto"
        />
      )}
    </button>
  )

  if (!content) return <DefaultSkeleton />

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
