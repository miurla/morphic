'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

import { UseChatHelpers } from '@ai-sdk/react'
import {
  IconBookmark as Bookmark,
  IconCopy as Copy,
  IconThumbDown as ThumbsDown,
  IconThumbUp as ThumbsUp
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { saveNote } from '@/lib/actions/notes'
import { captureClient } from '@/lib/analytics/posthog-client'
import { stripSpecBlocks } from '@/lib/render/strip-spec-blocks'
import type { SearchResultItem } from '@/lib/types'
import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import { cn } from '@/lib/utils'
import { processCitations } from '@/lib/utils/citation'

import { useLibrary } from './library/library-context'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
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
  isGuest?: boolean
  isCloudDeployment?: boolean
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
  isGuest = false,
  isCloudDeployment = false,
  className,
  status,
  visible = true,
  citationMaps
}: MessageActionsProps) {
  const [feedbackScore, setFeedbackScore] = useState<number | null>(
    initialFeedbackScore ?? null
  )
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const { openLibrary, upsertCachedNote } = useLibrary()
  const mappedMessage = useMemo(() => {
    if (!message) return ''
    return processCitations(message, citationMaps || {})
  }, [message, citationMaps])

  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const isLoading = status === 'submitted' || status === 'streaming'
  const showSaveButton = !isGuest || isCloudDeployment
  const saveButtonShownRef = useRef(false)

  useEffect(() => {
    if (!visible || !showSaveButton || saveButtonShownRef.current) return

    saveButtonShownRef.current = true
    captureClient('note_save_button_shown', {
      source: 'message_action',
      chatId,
      isGuest,
      isCloudDeployment
    })
  }, [chatId, isCloudDeployment, isGuest, showSaveButton, visible])

  // Keep the element mounted during loading to preserve layout; otherwise skip rendering.
  if (!visible && !isLoading) {
    return null
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(stripSpecBlocks(mappedMessage))
    toast.success('Message copied to clipboard')
  }

  async function handleSaveNote() {
    if (isSavingNote) return

    const content = stripSpecBlocks(mappedMessage)
    captureClient('note_save_clicked', {
      source: 'button',
      chatId,
      chars: content.length,
      isGuest,
      isCloudDeployment
    })

    if (isGuest) {
      setAuthPromptOpen(true)
      captureClient('library_auth_prompt_opened', {
        source: 'save_button',
        chatId
      })
      return
    }

    setIsSavingNote(true)
    try {
      const result = await saveNote({
        content,
        chatId,
        sourceMessageId: messageId
      })

      if (!result.success) {
        captureClient('note_save_failed', {
          source: 'button',
          chatId,
          reason: result.error ?? 'unknown'
        })
        toast.error(result.error ?? 'Failed to save note')
        return
      }

      if (result.note) {
        upsertCachedNote(result.note)
      }
      captureClient('note_saved', {
        source: 'button',
        chatId,
        chars: content.length
      })
      toast.success('Saved to library', {
        action: {
          label: 'Open',
          onClick: () => {
            openLibrary()
            captureClient('library_opened', { source: 'toast' })
          }
        }
      })
    } catch (error) {
      console.error('Error saving note:', error)
      captureClient('note_save_failed', {
        source: 'button',
        chatId,
        reason: 'exception'
      })
      toast.error('Failed to save note')
    } finally {
      setIsSavingNote(false)
    }
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
    <>
      <div
        aria-hidden={!visible}
        className={cn(
          'flex w-full items-center justify-between gap-3 self-stretch transition-opacity duration-200',
          visible ? 'opacity-100' : 'pointer-events-none opacity-0 invisible',
          className
        )}
      >
        <div className="flex items-center gap-0.5">
          {reload && <RetryButton reload={reload} messageId={messageId} />}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="rounded-full"
          >
            <Copy size={14} />
          </Button>
          {enableShare && chatId && <ChatShare chatId={chatId} />}
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
        </div>
        {showSaveButton ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveNote}
            disabled={isSavingNote}
            className="h-8 shrink-0 gap-1.5 rounded-full px-3"
            aria-label="Save to library"
          >
            <Bookmark size={14} />
            Save
          </Button>
        ) : (
          <div />
        )}
      </div>

      <Dialog open={authPromptOpen} onOpenChange={setAuthPromptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Bookmark className="size-6 text-muted-foreground" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Save notes to your library
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Sign in or create an account to save answers and selected text to
              your Library.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2">
            <Button asChild className="w-full">
              <Link
                href="/auth/sign-up"
                onClick={() =>
                  captureClient('library_auth_prompt_cta_clicked', {
                    source: 'save_button',
                    target: 'sign_up',
                    chatId
                  })
                }
              >
                Sign Up
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link
                href="/auth/login"
                onClick={() =>
                  captureClient('library_auth_prompt_cta_clicked', {
                    source: 'save_button',
                    target: 'sign_in',
                    chatId
                  })
                }
              >
                Sign In
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
