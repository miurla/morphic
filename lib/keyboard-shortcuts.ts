export type ShortcutDefinition = {
  id: string
  key: string
  meta: boolean
  shift: boolean
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
  }
} as const satisfies Record<string, ShortcutDefinition>

export const SHORTCUT_EVENTS = {
  newChat: 'shortcut:new-chat',
  copyMessage: 'shortcut:copy-message'
} as const

export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutDefinition
): boolean {
  if (event.repeat) return false
  if (event.altKey) return false
  return (
    event.key.toLowerCase() === shortcut.key &&
    (event.metaKey || event.ctrlKey) === shortcut.meta &&
    event.shiftKey === shortcut.shift
  )
}
