import { formatShortcutKeys, SHORTCUTS } from '@/lib/keyboard-shortcuts'

export const DISCLAIMER_TEXT =
  'Morphic can make mistakes. Please double-check responses.'

const SHORTCUT_ENTRIES = [
  SHORTCUTS.newChat,
  SHORTCUTS.copyMessage,
  SHORTCUTS.toggleSidebar,
  SHORTCUTS.toggleTheme,
  SHORTCUTS.toggleSearchMode,
  SHORTCUTS.showShortcuts
] as const

export type Tip = { keys: string[]; description: string }

// Lazily initialized to avoid hydration mismatch from navigator check
let cachedTips: Tip[] | null = null
export function getTips(): Tip[] {
  if (!cachedTips) {
    cachedTips = SHORTCUT_ENTRIES.map(s => ({
      keys: formatShortcutKeys(s),
      description: s.description
    }))
  }
  return cachedTips
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
