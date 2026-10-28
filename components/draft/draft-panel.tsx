'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  IconBookmark as Bookmark,
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconCopy as Copy,
  IconFileText as FileText,
  IconPencil as Pencil,
  IconX as X
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { saveNote } from '@/lib/actions/notes'
import { captureClient } from '@/lib/analytics/posthog-client'
import { buildDraftVersions, draftDisplayTitle } from '@/lib/draft/draft'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TooltipButton } from '@/components/ui/tooltip-button'

import { useArtifact } from '../artifact/artifact-context'
import { useLibrary } from '../library/library-context'
import { SaveNoteAuthDialog } from '../library/save-note-auth-dialog'
import { MarkdownMessage } from '../message'

import { useDraftStore, useLiveDraftBlock } from './draft-store'

type SelectionAnchor = { text: string; top: number; left: number }

export function DraftPanel() {
  const {
    messages,
    quote,
    chatId,
    isGuest = false,
    isCloudDeployment = false,
    libraryAvailable = false
  } = useDraftStore()
  const { close } = useArtifact()
  const { openLibrary, upsertCachedNote } = useLibrary()
  const [isSaving, setIsSaving] = useState(false)
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const versions = useMemo(() => buildDraftVersions(messages), [messages])

  // A draft block still streaming in the latest answer, shown live.
  const live = useLiveDraftBlock()

  // A picked version is remembered with the chat and the count it was picked
  // at, so a new version or another chat switches the panel back to the latest.
  const chatKey = versions[0]?.messageId
  const [picked, setPicked] = useState<{
    index: number
    total: number
    chatKey?: string
  }>()
  const index =
    picked && picked.total === versions.length && picked.chatKey === chatKey
      ? picked.index
      : null
  const setIndex = (next: number | null) =>
    setPicked(
      next === null
        ? undefined
        : { index: next, total: versions.length, chatKey }
    )

  const shown = index === null ? versions.at(-1) : versions[index]
  const position = index === null ? versions.length - 1 : index

  const bodyRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null)

  // selectionchange covers touch long-press selection, which fires no
  // mouseup. Clearing waits briefly: tapping the button collapses the
  // selection on touch devices before the tap lands.
  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim()
      const body = bodyRef.current
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null
      if (!text || !range || !body?.contains(range.commonAncestorContainer)) {
        clearTimeout(clearTimer)
        clearTimer = setTimeout(() => setAnchor(null), 300)
        return
      }
      clearTimeout(clearTimer)
      const rect = range.getBoundingClientRect()
      const bodyRect = body.getBoundingClientRect()
      setAnchor({
        text,
        top: rect.top - bodyRect.top - 36,
        left: Math.max(0, rect.left - bodyRect.left)
      })
    }
    document.addEventListener('selectionchange', update)
    return () => {
      clearTimeout(clearTimer)
      document.removeEventListener('selectionchange', update)
    }
  }, [])

  if (!live && !shown) {
    return (
      <>
        <DraftHeader title="Draft" onClose={close} />
        <p className="p-4 text-sm text-muted-foreground">
          No draft in this chat yet.
        </p>
      </>
    )
  }

  const title = draftDisplayTitle(live ?? shown!)
  const content = live ? live.content : shown!.content

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Draft copied')
    } catch {
      toast.error('Could not copy the draft')
    }
  }

  const showSaveButton = libraryAvailable && (!isGuest || isCloudDeployment)

  // Mirrors the answer Save button in message-actions.tsx, saving the
  // version shown in the panel.
  const save = async () => {
    if (isSaving || live || !shown) return

    captureClient('note_save_clicked', {
      source: 'draft_panel',
      chatId,
      chars: content.length,
      isGuest,
      isCloudDeployment
    })

    if (isGuest) {
      setAuthPromptOpen(true)
      captureClient('library_auth_prompt_opened', {
        source: 'draft_panel',
        chatId
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await saveNote({
        title,
        content,
        chatId,
        sourceMessageId: shown.messageId
      })

      if (!result.success) {
        captureClient('note_save_failed', {
          source: 'draft_panel',
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
        source: 'draft_panel',
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
        source: 'draft_panel',
        chatId,
        reason: 'exception'
      })
      toast.error('Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }

  const status = live
    ? `Writing… ${content.length.toLocaleString()} characters`
    : shown!.interrupted
      ? `Interrupted · ${content.length.toLocaleString()} characters`
      : shown!.kind === 'edit'
        ? `Edited · ${shown!.applied} change${shown!.applied === 1 ? '' : 's'}`
        : `${content.length.toLocaleString()} characters`

  return (
    <>
      <DraftHeader title={title || 'Draft'} onClose={close}>
        {!live && versions.length > 1 && (
          <span className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              aria-label="Previous version"
              disabled={position <= 0}
              onClick={() => setIndex(Math.max(0, position - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="tabular-nums">
              v{position + 1} / {versions.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              aria-label="Next version"
              disabled={position >= versions.length - 1}
              onClick={() =>
                setIndex(
                  position + 1 >= versions.length - 1 ? null : position + 1
                )
              }
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </span>
        )}
        <span className="tabular-nums">{status}</span>
        {!live && (
          <span className="flex items-center gap-1">
            <Pencil className="size-3" />
            Select text to edit it
          </span>
        )}
      </DraftHeader>

      <div data-vaul-no-drag className="flex-1 overflow-y-auto p-4">
        <div ref={bodyRef} className="relative">
          {anchor && quote && !live && (
            <Button
              size="sm"
              variant="secondary"
              className="absolute z-10 h-7 gap-1 shadow-sm"
              style={{ top: anchor.top, left: anchor.left }}
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                quote(anchor.text)
                window.getSelection()?.removeAllRanges()
                setAnchor(null)
                // The mobile drawer covers the composer the quote went to.
                if (window.matchMedia('(max-width: 767px)').matches) close()
              }}
            >
              <Pencil className="size-3.5" />
              Edit this
            </Button>
          )}
          <MarkdownMessage message={content} drafts={false} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 border-t px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Copy draft"
          disabled={!!live}
          onClick={copy}
        >
          <Copy className="size-4" />
        </Button>
        {showSaveButton && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Save to library"
            disabled={!!live || isSaving}
            onClick={save}
          >
            <Bookmark className="size-4" />
          </Button>
        )}
      </div>

      <SaveNoteAuthDialog
        open={authPromptOpen}
        onOpenChange={setAuthPromptOpen}
        source="draft_panel"
        chatId={chatId}
      />
    </>
  )
}

function DraftHeader({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children?: React.ReactNode
}) {
  return (
    <TooltipProvider>
      <div className="flex items-start gap-2 px-4 py-2">
        <div className="p-2">
          <FileText size={18} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5">
          <h3 className="truncate text-sm font-medium">{title}</h3>
          {children && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {children}
            </div>
          )}
        </div>
        <TooltipButton
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close panel"
          tooltipContent="Close"
        >
          <X className="size-4" />
        </TooltipButton>
      </div>
      <Separator className="my-1 bg-border/50" />
    </TooltipProvider>
  )
}
