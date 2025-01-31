'use client'

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
      <Lightbulb size={16} />
      <div className="w-full flex-1 flex items-center justify-between">
        <span>{content.answer?.length === 0 ? 'Thinking...' : 'Thoughts'}</span>
        {content.answer?.length === 0 && isLoading ? (
          <Loader2
            size={16}
            className="animate-spin text-muted-foreground/50"
          />
        ) : (
          <StatusIndicator icon={Check} iconClassName="text-green-500">
            {content.reasoning.trim().length.toLocaleString()} chars
          </StatusIndicator>
        )}
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
