'use client'

import { Lightbulb, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import { useArtifact } from '@/components/artifact/artifact-context'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { BotMessage } from './message'

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
        open({ type: 'reasoning', text: content.reasoning } as any)
      }
      className="flex items-center gap-2 w-full text-left rounded-md p-0.5 -ml-0.5 cursor-pointer"
      title="Open details"
    >
      <div className="w-full flex flex-col">
        <div className="flex items-center justify-between">
          <Badge className="flex items-center gap-0.5" variant="secondary">
            <Lightbulb size={16} />
            {!content.isDone ? 'Thinking...' : 'Thoughts'}
          </Badge>
          {!content.isDone && (
            <Loader2
              size={16}
              className="animate-spin text-muted-foreground/50"
            />
          )}
        </div>
      </div>
    </button>
  )

  if (!content) return <DefaultSkeleton />

  return (
    <div className="flex flex-col gap-4">
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={reasoningHeader}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showBorder={true}
        showIcon={false}
      >
        <div className="[&_p]:text-sm [&_p]:text-muted-foreground">
          <BotMessage message={content.reasoning} />
        </div>
      </CollapsibleMessage>
    </div>
  )
}
