'use client'

import { ChatRequestOptions } from 'ai'
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
  messageId: string
  reload?: (
    messageId: string,
    options?: ChatRequestOptions
  ) => Promise<string | null | undefined>
}

export function AnswerSection({
  content,
  isOpen,
  onOpenChange,
  chatId,
  showActions = true, // Default to true for backward compatibility
  messageId,
  reload
}: AnswerSectionProps) {
  const enableShare = process.env.NEXT_PUBLIC_ENABLE_SHARE === 'true'

  const handleReload = () => {
    if (reload) {
      return reload(messageId)
    }
    return Promise.resolve(undefined)
  }

  const message = content ? (
    <div className="flex flex-col gap-1">
      <BotMessage message={content} />
      {showActions && (
        <MessageActions
          message={content} // Keep original message content for copy
          messageId={messageId}
          chatId={chatId}
          enableShare={enableShare}
          reload={handleReload}
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
