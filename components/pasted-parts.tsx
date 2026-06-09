'use client'

import { useState } from 'react'

import {
  IconChevronDown as ChevronDown,
  IconChevronUp as ChevronUp,
  IconFileText as FileText
} from '@tabler/icons-react'

// Collapsed card for a pasted text blob (a `data-pastedContent` part, or a
// legacy `<user-content>` block in old messages).
export function PastedContentCard({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => setOpen(o => !o)}
      >
        <FileText className="size-3.5 shrink-0" />
        Pasted content · {text.length.toLocaleString()} chars
        {open ? (
          <ChevronUp className="size-3.5 shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0" />
        )}
      </button>
      {open && (
        <p className="mt-1.5 max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground/80">
          {text}
        </p>
      )}
    </div>
  )
}

// Favicon chip for a pasted URL (a `data-sourceUrl` part). Clickable.
export function UrlChip({ url }: { url: string }) {
  let host = url
  try {
    host = new URL(url).host.replace(/^www\./, '')
  } catch {}
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-input bg-background py-1 pl-2 pr-2.5 text-xs text-muted-foreground hover:text-foreground"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
        alt=""
        width={14}
        height={14}
        className="size-3.5 shrink-0 rounded-sm"
      />
      <span className="max-w-[220px] truncate">{host}</span>
    </a>
  )
}
