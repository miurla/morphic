'use client'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { BotMessage } from './message'
import { MessageActions } from './message-actions'

export type AnswerSectionProps = {
  content: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  chatId?: string
  showActions?: boolean
}

export function AnswerSection({
  content,
  isOpen,
  onOpenChange,
  chatId,
  showActions = true // Default to true for backward compatibility
}: AnswerSectionProps) {
  const enableShare = process.env.NEXT_PUBLIC_ENABLE_SHARE === 'true'

  const message = content ? (
    <div className="flex flex-col gap-1">
      <BotMessage message={content} />
      {showActions && (
        <MessageActions
          message={content}
          chatId={chatId}
          enableShare={enableShare}
        />
      )}
    </div>
  ) : (
    <DefaultSkeleton />
  )
  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={false}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showBorder={false}
      showIcon={false}
    >
      {message}
    </CollapsibleMessage>
  )
}
