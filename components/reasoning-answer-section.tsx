'use client'

import { Check, Lightbulb, Loader2 } from 'lucide-react'
import { ChatShare } from './chat-share'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { BotMessage } from './message'

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

  const reasoningHeader = (
    <div className="flex items-center gap-2 w-full">
      <Lightbulb size={16} />
      <div className="w-full flex-1 flex items-center justify-between">
        <span>{content.answer?.length === 0 ? 'Thinking...' : 'Thoughts'}</span>
        {content.answer?.length === 0 ? (
          <Loader2
            size={16}
            className="animate-spin text-muted-foreground/50"
          />
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Check size={16} className="text-green-500" />
            <span>{content.reasoning.trim().length} chars</span>
          </span>
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
        <div className="flex flex-col gap-4">
          <BotMessage message={content.answer || ''} />
          {enableShare && chatId && (
            <ChatShare chatId={chatId} className="self-end" />
          )}
        </div>
      </CollapsibleMessage>
    </div>
  )
}
