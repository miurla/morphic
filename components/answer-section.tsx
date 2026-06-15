'use client'

import type { ReactNode } from 'react'

import { UseChatHelpers } from '@ai-sdk/react'
import { ChatRequestOptions } from 'ai'

import { verifyAnswerClaims } from '@/lib/claims/evidence-verification'
import type { FactCheckSearchResults } from '@/lib/tools/factcheck'
import type { SearchResultItem } from '@/lib/types'
import type {
  UIDataTypes,
  UIMessage,
  UIMessageMetadata,
  UITools
} from '@/lib/types/ai'

import { EvidencePanel } from './evidence/evidence-panel'
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
  factCheckResults?: FactCheckSearchResults[]
  isGuest?: boolean
  supportingContent?: ReactNode
}

function splitTrailingRelatedSpecBlock(content: string) {
  const specBlockRegex = /```spec[\s\S]*?```/g
  const matches = [...content.matchAll(specBlockRegex)]
  const lastMatch = matches.at(-1)

  if (
    !lastMatch ||
    lastMatch.index === undefined ||
    content.slice(lastMatch.index + lastMatch[0].length).trim().length > 0 ||
    !/"title"\s*:\s*"Related"/.test(lastMatch[0])
  ) {
    return {
      mainContent: content,
      relatedSpecBlock: ''
    }
  }

  return {
    mainContent: content.slice(0, lastMatch.index).trimEnd(),
    relatedSpecBlock: lastMatch[0]
  }
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
  citationMaps,
  factCheckResults = [],
  isGuest = false,
  supportingContent
}: AnswerSectionProps) {
  const enableShare =
    process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined && !isGuest
  const enableClaimVerification =
    process.env.ENABLE_CLAIM_VERIFICATION === 'true'
  const claimVerification =
    enableClaimVerification && content
      ? verifyAnswerClaims({
          answer: content,
          citationMaps: citationMaps || {},
          factCheckResults
        })
      : undefined

  const handleReload = () => {
    if (reload) {
      return reload(messageId)
    }
    return Promise.resolve(undefined)
  }
  const { mainContent, relatedSpecBlock } =
    splitTrailingRelatedSpecBlock(content)

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
          <MarkdownMessage message={mainContent} citationMaps={citationMaps} />
          {claimVerification ? (
            <EvidencePanel result={claimVerification} />
          ) : null}
          {supportingContent ? (
            <div className="my-3">{supportingContent}</div>
          ) : null}
          {relatedSpecBlock ? (
            <MarkdownMessage
              message={relatedSpecBlock}
              citationMaps={citationMaps}
            />
          ) : null}
          <MessageActions
            message={content} // Provide original message; copy path remaps citations
            messageId={messageId}
            traceId={metadata?.traceId}
            feedbackScore={metadata?.feedbackScore}
            chatId={chatId}
            enableShare={enableShare}
            reload={handleReload}
            status={status}
            visible={showActions}
            citationMaps={citationMaps}
          />
        </div>
      )}
    </CollapsibleMessage>
  )
}
