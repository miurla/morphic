'use client'

import { useEffect, useRef } from 'react'

import {
  IconFileText as FileText,
  IconLoader2 as Loader
} from '@tabler/icons-react'

import { draftDisplayTitle, parseDraftFenceBody } from '@/lib/draft/draft'
import type { ToolPart } from '@/lib/types/ai'

import { useI18n } from '@/components/language-provider'

import { useArtifact } from '../artifact/artifact-context'

import { useLiveDraftBlock } from './draft-store'

function useOpenDraft() {
  const { open } = useArtifact()
  return () => open({ type: 'draft' })
}

function CardShell({
  title,
  detail,
  busy,
  onOpen
}: {
  title: string
  detail: string
  busy: boolean
  onOpen: () => void
}) {
  const { t } = useI18n()

  return (
    <button
      type="button"
      onClick={onOpen}
      className="not-prose my-3 flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        {busy ? (
          <Loader className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <FileText className="size-4 text-muted-foreground" />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {t('Open')}
      </span>
    </button>
  )
}

/** Stands in for a ````draft block in the answer; the content lives in the panel. */
export function DraftFenceCard({ code }: { code: string }) {
  const { t, locale } = useI18n()

  const openDraft = useOpenDraft()
  const live = useLiveDraftBlock()
  const draft = parseDraftFenceBody(code)
  const { content } = draft
  const title = draftDisplayTitle(draft)
  // Streamdown does not flag a four-backtick fence as incomplete, so the
  // streaming state comes from the latest answer's still-open block.
  const writing =
    live !== null && live.content.startsWith(content.slice(0, 200))
  const autoOpened = useRef(false)

  // Open the panel as a draft starts streaming, not when history loads.
  useEffect(() => {
    if (writing && !autoOpened.current) {
      autoOpened.current = true
      openDraft()
    }
  }, [writing, openDraft])

  return (
    <CardShell
      title={title || t('Draft')}
      detail={
        writing
          ? t('Writing… {count} characters', {
              count: content.length.toLocaleString(locale)
            })
          : t('{count} characters', {
              count: content.length.toLocaleString(locale)
            })
      }
      busy={writing}
      onOpen={openDraft}
    />
  )
}

type EditOutput = { applied?: number; failed?: unknown[]; message?: string }

/** Shown in the answer where the model edited the draft. */
export function DraftEditNotice({ part }: { part: ToolPart }) {
  const { t } = useI18n()

  const openDraft = useOpenDraft()
  const output = part.output as EditOutput | undefined
  const busy =
    part.state === 'input-streaming' || part.state === 'input-available'

  let detail = t('Editing…')
  if (part.state === 'output-error') detail = t('The edit failed')
  else if (part.state === 'output-available') {
    const applied = output?.applied ?? 0
    const failed = output?.failed?.length ?? 0
    detail =
      applied === 0
        ? t('No changes applied')
        : t(applied === 1 ? t('{count} change') : t('{count} changes'), {
            count: applied
          }) + (failed ? t(', {count} skipped', { count: failed }) : '')
  }

  return (
    <CardShell
      title={t('Edited the draft')}
      detail={detail}
      busy={busy}
      onOpen={openDraft}
    />
  )
}
