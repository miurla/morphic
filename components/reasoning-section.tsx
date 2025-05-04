'use client'

import { Badge } from '@/components/ui/badge'
import { Check, Lightbulb, Loader2 } from 'lucide-react'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { BotMessage } from './message'
import { StatusIndicator } from './ui/status-indicator'

interface ReasoningContent {
  reasoning: string
  time?: number
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
            {content.time === 0
              ? 'Thinking...'
              : content.time !== undefined && content.time > 0
              ? `Thought for ${(content.time / 1000).toFixed(1)} seconds`
              : 'Thoughts'}
          </Badge>
          {content.time === 0 ? (
            <Loader2
              size={16}
              className="animate-spin text-muted-foreground/50"
            />
          ) : (
            <StatusIndicator icon={Check} iconClassName="text-green-500">
              {`${content.reasoning.length.toLocaleString()} characters`}
            </StatusIndicator>
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
