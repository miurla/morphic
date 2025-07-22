'use client'

import { Check, Lightbulb, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import { StatusIndicator } from './ui/status-indicator'
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
  const reasoningHeader = (
    <div className="flex items-center gap-2 w-full">
      <div className="w-full flex flex-col">
        <div className="flex items-center justify-between">
          <Badge className="flex items-center gap-0.5" variant="secondary">
            <Lightbulb size={16} />
            {!content.isDone ? 'Thinking...' : 'Thoughts'}
          </Badge>
          {!content.isDone ? (
            <Loader2
              size={16}
              className="animate-spin text-muted-foreground/50"
            />
          ) : (
            <StatusIndicator
              icon={Check}
              iconClassName="text-green-500"
            ></StatusIndicator>
          )}
        </div>
      </div>
    </div>
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
        <BotMessage
          message={content.reasoning}
          className="prose-p:text-muted-foreground"
        />
      </CollapsibleMessage>
    </div>
  )
}
