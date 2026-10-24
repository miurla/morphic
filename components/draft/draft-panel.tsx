'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconCopy as Copy,
  IconPencil as Pencil
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { buildDraftVersions, draftDisplayTitle } from '@/lib/draft/draft'

import { Button } from '@/components/ui/button'

import { useArtifact } from '../artifact/artifact-context'
import { MarkdownMessage } from '../message'

import { useDraftStore, useLiveDraftBlock } from './draft-store'

type SelectionAnchor = { text: string; top: number; left: number }

export function DraftPanel() {
  const { messages, quote } = useDraftStore()
  const { close } = useArtifact()
  const versions = useMemo(() => buildDraftVersions(messages), [messages])

  // A draft block still streaming in the latest answer, shown live.
  const live = useLiveDraftBlock()

  // A picked version is remembered with the count it was picked at, so a new
  // version arriving switches the panel back to the latest.
  const [picked, setPicked] = useState<{ index: number; total: number }>()
  const index = picked && picked.total === versions.length ? picked.index : null
  const setIndex = (next: number | null) =>
    setPicked(
      next === null ? undefined : { index: next, total: versions.length }
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
      <p className="text-sm text-muted-foreground">
        No draft in this chat yet.
      </p>
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

  const status = live
    ? `Writing… ${content.length.toLocaleString()} characters`
    : shown!.kind === 'edit'
      ? `Edited · ${shown!.applied} change${shown!.applied === 1 ? '' : 's'}`
      : `${content.length.toLocaleString()} characters`

  return (
    <div className="flex flex-col">
      {/* Panel chrome, kept visually apart from the document below it. */}
      <div className="sticky -top-4 z-20 -mx-4 -mt-4 mb-4 flex flex-col gap-1.5 border-b bg-muted px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {title || 'Draft'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            // Same size as the panel's close button so the two icons line
            // up; the negative margin keeps the row compact.
            className="-my-2"
            aria-label="Copy draft"
            disabled={!!live}
            onClick={copy}
          >
            <Copy className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
          <span className="rounded bg-background px-1.5 py-0.5 tabular-nums">
            {status}
          </span>
          {!live && (
            <span className="flex items-center gap-1">
              <Pencil className="size-3" />
              Select text to edit it
            </span>
          )}
        </div>
      </div>

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
        <MarkdownMessage message={content} />
      </div>
    </div>
  )
}
