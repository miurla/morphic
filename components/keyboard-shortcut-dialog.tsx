'use client'

import { useEffect, useState } from 'react'

import {
  formatShortcutKeys,
  SHORTCUT_EVENTS,
  type ShortcutDefinition,
  SHORTCUTS
} from '@/lib/keyboard-shortcuts'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from './ui/dialog'

const shortcutList: ShortcutDefinition[] = Object.values(SHORTCUTS).filter(
  s => s.id !== 'showShortcuts'
)

function ShortcutKey({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[11px] text-muted-foreground">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(prev => !prev)
    window.addEventListener(SHORTCUT_EVENTS.showShortcuts, handler)
    return () =>
      window.removeEventListener(SHORTCUT_EVENTS.showShortcuts, handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            List of available keyboard shortcuts
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {shortcutList.map(shortcut => (
            <div
              key={shortcut.id}
              className="flex items-center justify-between rounded-md px-2 py-1.5"
            >
              <span className="text-sm text-foreground">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {formatShortcutKeys(shortcut).map((key, i) => (
                  <ShortcutKey key={i}>{key}</ShortcutKey>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t pt-1">
            <div className="flex items-center justify-between rounded-md px-2 py-1.5">
              <span className="text-sm text-foreground">
                {SHORTCUTS.showShortcuts.description}
              </span>
              <div className="flex items-center gap-1">
                {formatShortcutKeys(SHORTCUTS.showShortcuts).map((key, i) => (
                  <ShortcutKey key={i}>{key}</ShortcutKey>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
