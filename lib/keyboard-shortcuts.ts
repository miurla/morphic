export type ShortcutDefinition = {
  id: string
  key: string
  meta: boolean
  shift: boolean
  /** If true, ignore shiftKey state when matching (for keys like / that require Shift on some layouts) */
  ignoreShift?: boolean
  description: string
}

export const SHORTCUTS = {
  toggleSidebar: {
    id: 'toggleSidebar',
    key: 'b',
    meta: true,
    shift: false,
    description: 'Toggle sidebar'
  },
  newChat: {
    id: 'newChat',
    key: 'o',
    meta: true,
    shift: true,
    description: 'New chat'
  },
  toggleTheme: {
    id: 'toggleTheme',
    key: 'd',
    meta: true,
    shift: true,
    description: 'Cycle theme'
  },
  copyMessage: {
    id: 'copyMessage',
    key: 'c',
    meta: true,
    shift: true,
    description: 'Copy latest assistant message'
  },
  toggleSearchMode: {
    id: 'toggleSearchMode',
    key: 'm',
    meta: true,
    shift: true,
    description: 'Toggle search mode'
  },
  showShortcuts: {
    id: 'showShortcuts',
    key: '/',
    meta: true,
    shift: false,
    ignoreShift: true,
    description: 'Show keyboard shortcuts'
  }
} as const satisfies Record<string, ShortcutDefinition>

export const SHORTCUT_EVENTS = {
  newChat: 'shortcut:new-chat',
  copyMessage: 'shortcut:copy-message',
  showShortcuts: 'shortcut:show-shortcuts'
} as const

export function formatShortcutKeys(shortcut: ShortcutDefinition): string[] {
  const isMac =
    typeof navigator !== 'undefined' &&
    navigator.userAgent.toLowerCase().includes('mac')
  const keys: string[] = []
  keys.push(isMac ? '⌘' : 'Ctrl')
  if (shortcut.shift) keys.push('Shift')
  keys.push(shortcut.key.toUpperCase())
  return keys
}

export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutDefinition
): boolean {
  if (event.repeat) return false
  if (event.altKey) return false
  const shiftMatch = shortcut.ignoreShift
    ? true
    : event.shiftKey === shortcut.shift
  return (
    event.key.toLowerCase() === shortcut.key &&
    (event.metaKey || event.ctrlKey) === shortcut.meta &&
    shiftMatch
  )
}
