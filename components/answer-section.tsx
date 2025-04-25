'use client'

import { ChatMessage } from '@/lib/db'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { BotMessage } from './message'
import { MessageActions } from './message-actions'
import OutlineBox from './outline-box'

export type AnswerSectionProps = {
  message: ChatMessage
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onOutlineItemClick: (itemText: string, threadId: string) => void
  showActions?: boolean
}

export function AnswerSection({
  message,
  isOpen,
  onOpenChange,
  onOutlineItemClick,
  showActions = true
}: AnswerSectionProps) {
  const enableShare = process.env.NEXT_PUBLIC_ENABLE_SHARE === 'true'
  const outlineMarker = '@@outline'
  let mainContent = message.content
  let outlineText: string | null = null

  if (message.content && message.content.includes(outlineMarker)) {
    const parts = message.content.split(outlineMarker, 2)
    mainContent = parts[0]
    outlineText = parts[1].trim()
  }

  const messageContent = mainContent ? (
    <div className="flex flex-col gap-1">
      <BotMessage message={mainContent} />
      {outlineText && message.thread_id && (
        <OutlineBox
          outlineText={outlineText}
          threadId={message.thread_id}
          onItemClick={onOutlineItemClick}
        />
      )}
      {showActions && (
        <MessageActions
          message={message.content}
          chatId={message.thread_id}
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
      {messageContent}
    </CollapsibleMessage>
  )
}
