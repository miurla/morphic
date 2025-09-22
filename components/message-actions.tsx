'use client'

import { useMemo, useState } from 'react'

import { UseChatHelpers } from '@ai-sdk/react'
import { Copy, ThumbsDown, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'

import type { SearchResultItem } from '@/lib/types'
import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import { cn } from '@/lib/utils'
import { processCitations } from '@/lib/utils/citation'

import { Button } from './ui/button'
import { ChatShare } from './chat-share'
import { RetryButton } from './retry-button'

interface MessageActionsProps {
  message: string
  messageId: string
  traceId?: string
  feedbackScore?: number | null
  reload?: () => Promise<void | string | null | undefined>
  chatId?: string
  enableShare?: boolean
  className?: string
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  visible?: boolean
  citationMaps?: Record<string, Record<number, SearchResultItem>>
}

export function MessageActions({
  message,
  messageId,
  traceId,
  feedbackScore: initialFeedbackScore,
  reload,
  chatId,
  enableShare,
  className,
  status,
  visible = true,
  citationMaps
}: MessageActionsProps) {
  const [feedbackScore, setFeedbackScore] = useState<number | null>(
    initialFeedbackScore ?? null
  )
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const isLoading = status === 'submitted' || status === 'streaming'

  // Keep the element mounted during loading to preserve layout; otherwise skip rendering.
  if (!visible && !isLoading) {
    return null
  }

  const mappedMessage = useMemo(() => {
    if (!message) return ''
    return processCitations(message, citationMaps || {})
  }, [message, citationMaps])

  async function handleCopy() {
    await navigator.clipboard.writeText(mappedMessage)
    toast.success('Message copied to clipboard')
  }

  async function handleFeedback(score: number) {
    if (isSubmittingFeedback || !traceId) return

    setIsSubmittingFeedback(true)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traceId,
          score,
          messageId
        })
      })

      if (response.ok) {
        setFeedbackScore(score)
        toast.success(
          score === 1
            ? 'Thanks for the feedback!'
            : 'Thanks for letting us know!'
        )
      } else {
        console.error('Failed to submit feedback')
        toast.error('Failed to submit feedback')
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast.error('Failed to submit feedback')
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'flex items-center gap-0.5 self-end transition-opacity duration-200',
        visible
          ? 'opacity-100'
          : 'pointer-events-none opacity-0 invisible',
        className
      )}
    >
      {reload && <RetryButton reload={reload} messageId={messageId} />}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="rounded-full"
      >
        <Copy size={14} />
      </Button>
      {traceId && (
        <>
          {(feedbackScore === null || feedbackScore === 1) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleFeedback(1)}
              disabled={isSubmittingFeedback || feedbackScore === 1}
              className="rounded-full"
            >
              <ThumbsUp
                size={14}
                className={feedbackScore === 1 ? 'fill-current' : ''}
              />
            </Button>
          )}
          {(feedbackScore === null || feedbackScore === -1) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleFeedback(-1)}
              disabled={isSubmittingFeedback || feedbackScore === -1}
              className="rounded-full"
            >
              <ThumbsDown
                size={14}
                className={feedbackScore === -1 ? 'fill-current' : ''}
              />
            </Button>
          )}
        </>
      )}
      {enableShare && chatId && <ChatShare chatId={chatId} />}
    </div>
  )
}
