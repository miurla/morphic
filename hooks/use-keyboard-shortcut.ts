'use client'

import { useEffect, useRef } from 'react'

import {
  matchesShortcut,
  type ShortcutDefinition} from '@/lib/keyboard-shortcuts'

export function useKeyboardShortcut(
  shortcut: ShortcutDefinition,
  handler: () => void
): void {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (matchesShortcut(event, shortcut)) {
        event.preventDefault()
        handlerRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcut])
}
