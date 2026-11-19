'use client'

import {
  addTransitionType,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition
} from 'react'

import { toast } from 'sonner'

import { deleteSpace, listSpaces, saveSpace } from '@/lib/actions/spaces'
import { captureClient } from '@/lib/analytics/posthog-client'
import type { Space } from '@/lib/db/schema'
import { getSpaceDisplayName, isSpaceColor } from '@/lib/spaces/space'
import { setCookie } from '@/lib/utils/cookies'

import {
  DEFAULT_SPACE_COLOR,
  SPACE_COLOR_COOKIE,
  SPACE_COLORS,
  type SpaceColor
} from './space-colors'

export type SpaceFields = { name: string; about: string; style: string }
type SavedSpace = SpaceFields & { id: string }

const EMPTY_FIELDS: SpaceFields = { name: '', about: '', style: '' }
const SAVE_DELAY_MS = 600
const EDIT_PARAM = 'space'
const EDIT_VALUE = 'edit'
const PEEK_SEEN_KEY = 'morphic:spaces-peek-seen'

export function isEmptySpace(fields?: SpaceFields): boolean {
  return (
    !fields ||
    (!fields.name.trim() && !fields.about.trim() && !fields.style.trim())
  )
}

function toSaved(space: Space): SavedSpace {
  return {
    id: space.id,
    name: space.name,
    about: space.about,
    style: space.style
  }
}

type EditorState = {
  color: SpaceColor
  // Where to go back to if the space being edited ends up not existing.
  returnTo: SpaceColor
  // Selected space when the editor opened, to tell whether closing switched.
  openedFrom: SpaceColor
}

type SpacesState = {
  loaded: boolean
  saved: Partial<Record<SpaceColor, SavedSpace>>
  drafts: Partial<Record<SpaceColor, SpaceFields>>
  active: SpaceColor
  editor: EditorState | null
  // Fixed order of the dots around the home logo, so a switch swaps two.
  slots: SpaceColor[]
}

type SpacesContextValue = {
  enabled: boolean
  loaded: boolean
  active: SpaceColor
  editor: EditorState | null
  peekSeen: boolean
  /** Created spaces (and drafts with text) in color order. */
  existing: SpaceColor[]
  /** Dots around the home logo: every existing space but the active one. */
  slots: SpaceColor[]
  /** Next unused color, or null when all are taken. */
  nextFree: SpaceColor | null
  fieldsOf: (color: SpaceColor) => SpaceFields
  nameOf: (color: SpaceColor) => string
  isSaved: (color: SpaceColor) => boolean
  /** Color to send with a new chat, or the default when none applies. */
  colorForNewChat: () => SpaceColor
  switchTo: (color: SpaceColor) => void
  openEditor: (color?: SpaceColor) => void
  closeEditor: () => void
  editColor: (color: SpaceColor) => void
  updateField: (field: keyof SpaceFields, value: string) => void
  removeSpace: (color: SpaceColor) => Promise<boolean>
  markPeekSeen: () => void
}

const SpacesContext = createContext<SpacesContextValue | null>(null)

function readPeekSeen(): boolean {
  try {
    return window.localStorage.getItem(PEEK_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

const peekListeners = new Set<() => void>()
function subscribePeekSeen(listener: () => void) {
  peekListeners.add(listener)
  return () => {
    peekListeners.delete(listener)
  }
}

function urlHasEditParam(): boolean {
  return (
    new URLSearchParams(window.location.search).get(EDIT_PARAM) === EDIT_VALUE
  )
}

function urlWithEditParam(on: boolean): string {
  const url = new URL(window.location.href)
  if (on) url.searchParams.set(EDIT_PARAM, EDIT_VALUE)
  else url.searchParams.delete(EDIT_PARAM)
  return `${url.pathname}${url.search}${url.hash}`
}

export function SpacesProvider({
  enabled,
  initialColor,
  children
}: {
  enabled: boolean
  initialColor?: string
  children: React.ReactNode
}) {
  const [state, setState] = useState<SpacesState>(() => ({
    loaded: false,
    saved: {},
    drafts: {},
    active:
      enabled && isSpaceColor(initialColor)
        ? initialColor
        : DEFAULT_SPACE_COLOR,
    editor: null,
    slots: []
  }))
  const peekSeen = useSyncExternalStore(
    subscribePeekSeen,
    readPeekSeen,
    () => true
  )
  const [, startTransition] = useTransition()
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  })

  const saveTimers = useRef(
    new Map<SpaceColor, ReturnType<typeof setTimeout>>()
  )
  const saveQueues = useRef(new Map<SpaceColor, Promise<void>>())
  const pushedHistory = useRef(false)
  // Saved rows change from async saves; read them here, not from stateRef,
  // which only catches up after a render.
  const savedRef = useRef<SpacesState['saved']>({})
  const setSaved = useCallback(
    (color: SpaceColor, space: SavedSpace | undefined) => {
      const saved = { ...savedRef.current }
      if (space) saved[color] = space
      else delete saved[color]
      savedRef.current = saved
      setState(prev => ({ ...prev, saved }))
    },
    []
  )

  const animate = useCallback((update: (prev: SpacesState) => SpacesState) => {
    // A hidden page aborts view transitions with an uncaught error.
    if (document.hidden) {
      setState(update)
      return
    }
    startTransition(() => {
      addTransitionType('space')
      setState(update)
    })
  }, [])

  const enqueue = useCallback(
    (color: SpaceColor, task: () => Promise<void>) => {
      const previous = saveQueues.current.get(color) ?? Promise.resolve()
      const next = previous.then(task, task)
      saveQueues.current.set(color, next)
      return next
    },
    []
  )

  const persist = useCallback(
    (color: SpaceColor) =>
      enqueue(color, async () => {
        const fields = stateRef.current.drafts[color]
        if (!fields) return
        const before = savedRef.current[color]
        // Nothing written yet, so there is nothing to create.
        if (!before && isEmptySpace(fields)) return
        if (
          before &&
          before.name === fields.name &&
          before.about === fields.about &&
          before.style === fields.style
        ) {
          return
        }

        const result = await saveSpace({ color, ...fields })
        if (!result.success || !result.space) {
          toast.error(result.error ?? 'Failed to save space.')
          return
        }

        setSaved(color, toSaved(result.space))
        const isDefault = color === DEFAULT_SPACE_COLOR
        if (!before && !isDefault) {
          captureClient('space_created', { color })
        }
        if (
          !before ||
          before.about !== fields.about ||
          before.style !== fields.style
        ) {
          captureClient('space_instructions_saved', {
            color,
            isDefault,
            hasAbout: fields.about.trim().length > 0,
            hasStyle: fields.style.trim().length > 0
          })
        }
      }),
    [enqueue, setSaved]
  )

  const flush = useCallback(
    async (color: SpaceColor) => {
      const timer = saveTimers.current.get(color)
      if (timer) {
        clearTimeout(timer)
        saveTimers.current.delete(color)
        await persist(color)
      } else {
        await saveQueues.current.get(color)
      }
    },
    [persist]
  )

  // Leaving a space in the editor: save what is pending, then drop it if
  // it was left empty. The default space is never dropped.
  const settle = useCallback(
    async (color: SpaceColor) => {
      await flush(color)
      if (color === DEFAULT_SPACE_COLOR) return
      const fields = stateRef.current.drafts[color]
      if (!isEmptySpace(fields)) return
      if (savedRef.current[color]) {
        await enqueue(color, async () => {
          const result = await deleteSpace(color)
          if (result.success) setSaved(color, undefined)
        })
      }
    },
    [enqueue, flush, setSaved]
  )

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void listSpaces().then(result => {
      if (cancelled) return
      const saved: SpacesState['saved'] = {}
      for (const space of result.spaces) {
        if (isSpaceColor(space.color)) saved[space.color] = toSaved(space)
      }
      savedRef.current = saved
      // A reload with ?space=edit reopens the editor.
      const reopen = urlHasEditParam()
      setState(prev => {
        const active =
          result.success &&
          prev.active !== DEFAULT_SPACE_COLOR &&
          !saved[prev.active] &&
          !prev.editor
            ? DEFAULT_SPACE_COLOR
            : prev.active
        const editor =
          prev.editor ??
          (reopen
            ? { color: active, returnTo: active, openedFrom: active }
            : null)
        return {
          ...prev,
          loaded: result.success,
          saved,
          // A space removed elsewhere falls back to the default.
          active,
          editor,
          drafts:
            editor && !prev.drafts[editor.color]
              ? {
                  ...prev.drafts,
                  [editor.color]: saved[editor.color] ?? EMPTY_FIELDS
                }
              : prev.drafts
        }
      })
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  const activeIsReal =
    state.active === DEFAULT_SPACE_COLOR || !!state.saved[state.active]
  useEffect(() => {
    if (!enabled || !activeIsReal) return
    setCookie(SPACE_COLOR_COOKIE, state.active, 365)
  }, [enabled, activeIsReal, state.active])

  const finishClose = useCallback(() => {
    const editor = stateRef.current.editor
    if (!editor) return
    const color = editor.color
    animate(prev => {
      if (!prev.editor) return prev
      const active =
        prev.saved[color] ||
        color === DEFAULT_SPACE_COLOR ||
        !isEmptySpace(prev.drafts[color])
          ? color
          : prev.editor.returnTo
      return { ...prev, editor: null, active }
    })
    void settle(color).then(() => {
      const prev = stateRef.current
      const saved = savedRef.current
      const active =
        prev.active === DEFAULT_SPACE_COLOR || saved[prev.active]
          ? prev.active
          : saved[editor.returnTo]
            ? editor.returnTo
            : DEFAULT_SPACE_COLOR
      setState(current => {
        const drafts = { ...current.drafts }
        delete drafts[color]
        return { ...current, drafts, active }
      })
      if (active !== editor.openedFrom) {
        captureClient('space_switched', {
          from: editor.openedFrom,
          to: active,
          source: 'settings'
        })
      }
    })
  }, [animate, settle])

  const openEditor = useCallback(
    (color?: SpaceColor) => {
      const current = stateRef.current
      // Before saved spaces load, a draft would start empty and its first
      // save would overwrite the stored instructions.
      if (!enabled || !current.loaded || current.editor) return
      const target = color ?? current.active
      animate(prev => ({
        ...prev,
        active: target,
        editor: {
          color: target,
          returnTo: prev.active,
          openedFrom: prev.active
        },
        drafts: {
          ...prev.drafts,
          [target]: prev.drafts[target] ?? prev.saved[target] ?? EMPTY_FIELDS
        }
      }))
      if (!urlHasEditParam()) {
        window.history.pushState(
          window.history.state,
          '',
          urlWithEditParam(true)
        )
        pushedHistory.current = true
      }
    },
    [animate, enabled]
  )

  const closeEditor = useCallback(() => {
    if (!stateRef.current.editor) return
    if (pushedHistory.current && urlHasEditParam()) {
      // The popstate handler closes the editor.
      window.history.back()
      return
    }
    window.history.replaceState(
      window.history.state,
      '',
      urlWithEditParam(false)
    )
    finishClose()
  }, [finishClose])

  useEffect(() => {
    if (!enabled) return
    // React runs updates inside popstate synchronously, which skips the
    // view transition, so handle the change after the event.
    const onPopState = () => {
      setTimeout(() => {
        const wantsEditor = urlHasEditParam()
        if (!wantsEditor && stateRef.current.editor) {
          pushedHistory.current = false
          finishClose()
        } else if (wantsEditor && !stateRef.current.editor) {
          openEditor()
        }
      }, 0)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [enabled, finishClose, openEditor])

  const editColor = useCallback(
    (color: SpaceColor) => {
      const editor = stateRef.current.editor
      if (!editor || editor.color === color) return
      const leaving = editor.color
      const leavingExists =
        leaving === DEFAULT_SPACE_COLOR ||
        !isEmptySpace(stateRef.current.drafts[leaving])
      setState(prev => {
        if (!prev.editor) return prev
        const drafts = { ...prev.drafts }
        if (!leavingExists) delete drafts[leaving]
        drafts[color] = drafts[color] ?? prev.saved[color] ?? EMPTY_FIELDS
        return {
          ...prev,
          drafts,
          active: color,
          editor: {
            ...prev.editor,
            color,
            returnTo: leavingExists ? leaving : prev.editor.returnTo
          }
        }
      })
      void settle(leaving).then(() => {
        setState(prev => {
          if (prev.editor?.color === leaving) return prev
          const drafts = { ...prev.drafts }
          delete drafts[leaving]
          return { ...prev, drafts }
        })
      })
    },
    [settle]
  )

  const updateField = useCallback(
    (field: keyof SpaceFields, value: string) => {
      const editor = stateRef.current.editor
      if (!editor) return
      const color = editor.color
      setState(prev => ({
        ...prev,
        drafts: {
          ...prev.drafts,
          [color]: {
            ...(prev.drafts[color] ?? prev.saved[color] ?? EMPTY_FIELDS),
            [field]: value
          }
        }
      }))
      const timers = saveTimers.current
      clearTimeout(timers.get(color))
      timers.set(
        color,
        setTimeout(() => {
          timers.delete(color)
          void persist(color)
        }, SAVE_DELAY_MS)
      )
    },
    [persist]
  )

  const removeSpace = useCallback(
    async (color: SpaceColor) => {
      if (color === DEFAULT_SPACE_COLOR) return false
      clearTimeout(saveTimers.current.get(color))
      saveTimers.current.delete(color)
      let ok = false
      await enqueue(color, async () => {
        if (!savedRef.current[color]) {
          ok = true
          return
        }
        const result = await deleteSpace(color)
        if (!result.success) {
          toast.error(result.error ?? 'Failed to delete space.')
          return
        }
        ok = true
      })
      if (!ok) return false
      const saved = { ...savedRef.current }
      delete saved[color]
      savedRef.current = saved
      setState(prev => {
        const drafts = { ...prev.drafts }
        delete drafts[color]
        const fallback =
          prev.editor && prev.editor.returnTo !== color
            ? prev.editor.returnTo
            : DEFAULT_SPACE_COLOR
        const editor = prev.editor
          ? {
              ...prev.editor,
              color: prev.editor.color === color ? fallback : prev.editor.color,
              returnTo:
                prev.editor.returnTo === color
                  ? DEFAULT_SPACE_COLOR
                  : prev.editor.returnTo
            }
          : null
        if (editor) {
          drafts[editor.color] =
            drafts[editor.color] ?? saved[editor.color] ?? EMPTY_FIELDS
        }
        return {
          ...prev,
          saved,
          drafts,
          editor,
          active: prev.active === color ? fallback : prev.active
        }
      })
      return true
    },
    [enqueue]
  )

  const existing = useMemo(
    () =>
      SPACE_COLORS.filter(
        color =>
          color === DEFAULT_SPACE_COLOR ||
          !!state.saved[color] ||
          !isEmptySpace(state.drafts[color])
      ),
    [state.saved, state.drafts]
  )

  const slots = useMemo(() => {
    const others = existing.filter(color => color !== state.active)
    const same =
      state.slots.length === others.length &&
      others.every(color => state.slots.includes(color))
    return same ? state.slots : others
  }, [existing, state.active, state.slots])

  const switchTo = useCallback(
    (color: SpaceColor) => {
      const current = stateRef.current
      if (color === current.active) return
      const from = current.active
      const nextSlots = slots.map(slot => (slot === color ? from : slot))
      animate(prev => ({ ...prev, active: color, slots: nextSlots }))
      captureClient('space_switched', { from, to: color, source: 'home' })
    },
    [animate, slots]
  )

  const markPeekSeen = useCallback(() => {
    try {
      window.localStorage.setItem(PEEK_SEEN_KEY, '1')
    } catch {}
    peekListeners.forEach(listener => listener())
  }, [])

  const value = useMemo<SpacesContextValue>(() => {
    const fieldsOf = (color: SpaceColor) =>
      state.drafts[color] ?? state.saved[color] ?? EMPTY_FIELDS
    return {
      enabled,
      loaded: state.loaded,
      active: state.active,
      editor: state.editor,
      peekSeen,
      existing,
      slots,
      nextFree:
        SPACE_COLORS.find(
          color => color !== state.active && !existing.includes(color)
        ) ?? null,
      fieldsOf,
      nameOf: color =>
        getSpaceDisplayName({ color, name: fieldsOf(color).name }),
      isSaved: color => !!state.saved[color],
      colorForNewChat: () => {
        const { active, loaded } = stateRef.current
        if (active === DEFAULT_SPACE_COLOR) return DEFAULT_SPACE_COLOR
        // A query sent on mount can beat the load; the server checks that
        // the user owns the space and falls back to the default otherwise.
        if (!loaded) return active
        return savedRef.current[active] ? active : DEFAULT_SPACE_COLOR
      },
      switchTo,
      openEditor,
      closeEditor,
      editColor,
      updateField,
      removeSpace,
      markPeekSeen
    }
  }, [
    enabled,
    state.loaded,
    state.active,
    state.editor,
    state.drafts,
    state.saved,
    peekSeen,
    existing,
    slots,
    switchTo,
    openEditor,
    closeEditor,
    editColor,
    updateField,
    removeSpace,
    markPeekSeen
  ])

  return (
    <SpacesContext.Provider value={value}>{children}</SpacesContext.Provider>
  )
}

const DISABLED: SpacesContextValue = {
  enabled: false,
  loaded: false,
  active: DEFAULT_SPACE_COLOR,
  editor: null,
  peekSeen: true,
  existing: [DEFAULT_SPACE_COLOR],
  slots: [],
  nextFree: null,
  fieldsOf: () => EMPTY_FIELDS,
  nameOf: color => getSpaceDisplayName({ color, name: '' }),
  isSaved: () => false,
  colorForNewChat: () => DEFAULT_SPACE_COLOR,
  switchTo: () => {},
  openEditor: () => {},
  closeEditor: () => {},
  editColor: () => {},
  updateField: () => {},
  removeSpace: async () => false,
  markPeekSeen: () => {}
}

export function useSpaces(): SpacesContextValue {
  return useContext(SpacesContext) ?? DISABLED
}
