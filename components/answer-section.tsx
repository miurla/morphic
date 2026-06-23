'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { UseChatHelpers } from '@ai-sdk/react'
import {
  IconBookmark as Bookmark,
  IconMessageCirclePlus as MessageCirclePlus
} from '@tabler/icons-react'
import { ChatRequestOptions } from 'ai'
import { toast } from 'sonner'

import { saveNote } from '@/lib/actions/notes'
import { captureClient } from '@/lib/analytics/posthog-client'
import type { SearchResultItem } from '@/lib/types'
import type {
  UIDataTypes,
  UIMessage,
  UIMessageMetadata,
  UITools
} from '@/lib/types/ai'

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
  isGuest?: boolean
  isCloudDeployment?: boolean
  libraryAvailable?: boolean
  onQuoteContext?: (text: string) => void
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
  isGuest = false,
  isCloudDeployment = false,
  libraryAvailable = true,
  onQuoteContext
}: AnswerSectionProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<{
    text: string
    top: number
    left: number
  } | null>(null)
  const [isSavingSelection, setIsSavingSelection] = useState(false)
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const lastTrackedSelectionKeyRef = useRef<string | null>(null)
  const { openLibrary, upsertCachedNote } = useLibrary()
  const enableShare =
    process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined && !isGuest
  const showSelectionSaveButton =
    libraryAvailable && (!isGuest || isCloudDeployment)
  const showSelectionDeepDiveButton = Boolean(onQuoteContext)

  useEffect(() => {
    if (!selection) return

    const clearSelection = () => {
      setSelection(null)
      lastTrackedSelectionKeyRef.current = null
    }

    const handleSelectionChange = () => {
      const text = window.getSelection()?.toString().trim()
      if (!text) {
        clearSelection()
      }
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return

      if (contentRef.current?.contains(target)) return
      if (
        target instanceof Element &&
        target.closest('[data-selection-actions]')
      ) {
        return
      }

      clearSelection()
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('scroll', clearSelection, true)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('scroll', clearSelection, true)
    }
  }, [selection])

  const handleReload = () => {
    if (reload) {
      return reload(messageId)
    }
    return Promise.resolve(undefined)
  }

  const updateSelection = () => {
    const currentSelection = window.getSelection()
    const text = currentSelection?.toString().trim()
    if (!text || !currentSelection || currentSelection.rangeCount === 0) {
      setSelection(null)
      lastTrackedSelectionKeyRef.current = null
      return
    }

    const range = currentSelection.getRangeAt(0)
    const container = contentRef.current
    if (
      !container ||
      !container.contains(range.commonAncestorContainer) ||
      text.length < 2
    ) {
      setSelection(null)
      lastTrackedSelectionKeyRef.current = null
      return
    }

    const rect = range.getBoundingClientRect()
    const trackingKey = `${messageId}:${text.length}:${Math.round(rect.top)}:${Math.round(rect.left)}`
    if (lastTrackedSelectionKeyRef.current !== trackingKey) {
      lastTrackedSelectionKeyRef.current = trackingKey
      captureClient('selection_note_actions_shown', {
        chatId,
        chars: text.length,
        isGuest,
        isCloudDeployment
      })
    }

    setSelection({
      text,
      top: Math.max(8, rect.top - 42),
      left: Math.max(8, Math.min(window.innerWidth - 220, rect.left))
    })
  }

  async function handleSaveSelection() {
    if (!selection || isSavingSelection) return

    captureClient('note_save_clicked', {
      source: 'selection',
      chatId,
      chars: selection.text.length,
      isGuest,
      isCloudDeployment
    })

    if (isGuest) {
      setAuthPromptOpen(true)
      captureClient('library_auth_prompt_opened', {
        source: 'selection_save',
        chatId
      })
      return
    }

    setIsSavingSelection(true)
    try {
      const result = await saveNote({
        content: selection.text,
        chatId,
        sourceMessageId: messageId
      })

      if (!result.success) {
        captureClient('note_save_failed', {
          source: 'selection',
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
        source: 'selection',
        chatId,
        chars: selection.text.length
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
      setSelection(null)
      window.getSelection()?.removeAllRanges()
    } catch (error) {
      console.error('Error saving selected note:', error)
      captureClient('note_save_failed', {
        source: 'selection',
        chatId,
        reason: 'exception'
      })
      toast.error('Failed to save note')
    } finally {
      setIsSavingSelection(false)
    }
  }

  function handleQuoteSelection() {
    if (!selection) return

    onQuoteContext?.(selection.text)
    captureClient('selection_followup', {
      chatId,
      chars: selection.text.length
    })
    setSelection(null)
    window.getSelection()?.removeAllRanges()
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
          <div
            ref={contentRef}
            onMouseUp={updateSelection}
            onKeyUp={updateSelection}
          >
            <MarkdownMessage message={content} citationMaps={citationMaps} />
          </div>
          {selection &&
            (showSelectionSaveButton || showSelectionDeepDiveButton) && (
              <div
                data-selection-actions
                className="fixed z-40 flex items-center gap-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                style={{ top: selection.top, left: selection.left }}
                onMouseDown={event => event.preventDefault()}
              >
                {showSelectionSaveButton && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    disabled={isSavingSelection}
                    onClick={handleSaveSelection}
                  >
                    <Bookmark className="size-3.5" />
                    Save
                  </Button>
                )}
                {showSelectionDeepDiveButton && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={handleQuoteSelection}
                  >
                    <MessageCirclePlus className="size-3.5" />
                    Deep dive
                  </Button>
                )}
              </div>
            )}
          <MessageActions
            message={content} // Provide original message; copy path remaps citations
            messageId={messageId}
            traceId={metadata?.traceId}
            feedbackScore={metadata?.feedbackScore}
            chatId={chatId}
            enableShare={enableShare}
            isGuest={isGuest}
            isCloudDeployment={isCloudDeployment}
            libraryAvailable={libraryAvailable}
            reload={handleReload}
            status={status}
            visible={showActions}
            citationMaps={citationMaps}
          />
        </div>
      )}
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
              Sign in or create an account to save selected text to your
              Library.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2">
            <Button asChild className="w-full">
              <Link
                href="/auth/sign-up"
                onClick={() =>
                  captureClient('library_auth_prompt_cta_clicked', {
                    source: 'selection_save',
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
                    source: 'selection_save',
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
    </CollapsibleMessage>
  )
}
