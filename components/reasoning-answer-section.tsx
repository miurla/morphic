'use client'

import { Badge } from '@/components/ui/badge'
import { CHAT_ID } from '@/lib/constants'
import { useChat } from 'ai/react'
import { Check, Lightbulb, Loader2 } from 'lucide-react'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { BotMessage } from './message'
import { MessageActions } from './message-actions'
import { StatusIndicator } from './ui/status-indicator'

interface ReasoningAnswerContent {
  reasoning: string
  answer?: string
  time?: number
}

export interface ReasoningAnswerSectionProps {
  content: ReasoningAnswerContent
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  chatId?: string
}

export function ReasoningAnswerSection({
  content,
  isOpen,
  onOpenChange,
  chatId
}: ReasoningAnswerSectionProps) {
  const enableShare = process.env.NEXT_PUBLIC_ENABLE_SHARE === 'true'
  const { isLoading } = useChat({ id: CHAT_ID })

  const reasoningHeader = (
    <div className="flex items-center gap-2 w-full">
      <div className="w-full flex flex-col">
        <div className="flex items-center justify-between">
          <Badge className="flex items-center gap-0.5" variant="secondary">
            <Lightbulb size={16} />
            {content.answer?.length === 0
              ? 'Thinking...'
              : content.time !== undefined && content.time > 0
              ? `Thought for ${(content.time / 1000).toFixed(1)} seconds`
              : 'Thoughts'}
          </Badge>
          {content.answer?.length === 0 && isLoading ? (
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
      >
        <BotMessage
          message={content.reasoning}
          className="prose-p:text-muted-foreground"
        />
      </CollapsibleMessage>

      <CollapsibleMessage
        role="assistant"
        isCollapsible={false}
        showIcon={false}
      >
        {content.answer && (
          <div className="flex flex-col gap-4">
            <BotMessage message={content.answer || ''} />
            <MessageActions
              message={content.answer || ''}
              chatId={chatId}
              enableShare={enableShare}
            />
          </div>
        )}
      </CollapsibleMessage>
    </div>
  )
}
