'use client'

import { UseChatHelpers } from '@ai-sdk/react'
import { ChatRequestOptions } from 'ai'

import type { SearchResultItem } from '@/lib/types'
import type {
  UIDataTypes,
  UIMessage,
  UIMessageMetadata,
  UITools
} from '@/lib/types/ai'

import { CollapsibleMessage } from './collapsible-message'
import { MarkdownMessage } from './message'
import { MessageActions } from './message-actions'

export type AnswerSectionProps = {
  content: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  chatId?: string
  showActions?: boolean
  messageId: string
  metadata?: UIMessageMetadata
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  reload?: (
    messageId: string,
    options?: ChatRequestOptions
  ) => Promise<void | string | null | undefined>
  citationMaps?: Record<string, Record<number, SearchResultItem>>
}

export function AnswerSection({
  content,
  isOpen,
  onOpenChange,
  chatId,
  showActions = true, // Default to true for backward compatibility
  messageId,
  metadata,
  status,
  reload,
  citationMaps
}: AnswerSectionProps) {
  const enableShare = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined

  const handleReload = () => {
    if (reload) {
      return reload(messageId)
    }
    return Promise.resolve(undefined)
  }

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={false}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showBorder={false}
      showIcon={false}
    >
      {content && (
        <div className="flex flex-col gap-1">
          <MarkdownMessage message={content} citationMaps={citationMaps} />
          <MessageActions
            message={content} // Keep original message content for copy
            messageId={messageId}
            traceId={metadata?.traceId}
            feedbackScore={metadata?.feedbackScore}
            chatId={chatId}
            enableShare={enableShare}
            reload={handleReload}
            status={status}
            visible={showActions}
          />
        </div>
      )}
    </CollapsibleMessage>
  )
}
