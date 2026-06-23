'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react'

import type { Note } from '@/lib/db/schema'

import { useSidebar } from '../ui/sidebar'

type NotesCache = {
  notes: Note[]
  updatedAt: number
}

type LibraryContextValue = {
  isOpen: boolean
  notesCache: NotesCache | null
  refreshKey: number
  openLibrary: () => void
  closeLibrary: () => void
  toggleLibrary: () => void
  replaceNotesCache: (notes: Note[]) => void
  upsertCachedNote: (note: Note) => void
  removeCachedNote: (noteId: string) => void
  refreshLibrary: () => void
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notesCache, setNotesCache] = useState<NotesCache | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const { setOpen: setSidebarOpen } = useSidebar()

  const openLibrary = useCallback(() => {
    setSidebarOpen(false)
    setIsOpen(true)
  }, [setSidebarOpen])
  const closeLibrary = useCallback(() => setIsOpen(false), [])
  const toggleLibrary = useCallback(() => {
    setIsOpen(open => {
      if (!open) {
        setSidebarOpen(false)
      }
      return !open
    })
  }, [setSidebarOpen])
  const replaceNotesCache = useCallback((notes: Note[]) => {
    setNotesCache({ notes, updatedAt: Date.now() })
  }, [])
  const upsertCachedNote = useCallback((note: Note) => {
    setNotesCache(cache => {
      if (!cache) return cache

      return {
        notes: [note, ...cache.notes.filter(item => item.id !== note.id)],
        updatedAt: Date.now()
      }
    })
  }, [])
  const removeCachedNote = useCallback((noteId: string) => {
    setNotesCache(cache => {
      if (!cache) return cache

      return {
        notes: cache.notes.filter(note => note.id !== noteId),
        updatedAt: Date.now()
      }
    })
  }, [])
  const refreshLibrary = useCallback(() => {
    setRefreshKey(key => key + 1)
  }, [])

  const value = useMemo(
    () => ({
      isOpen,
      notesCache,
      refreshKey,
      openLibrary,
      closeLibrary,
      toggleLibrary,
      replaceNotesCache,
      upsertCachedNote,
      removeCachedNote,
      refreshLibrary
    }),
    [
      closeLibrary,
      isOpen,
      notesCache,
      openLibrary,
      removeCachedNote,
      replaceNotesCache,
      refreshLibrary,
      toggleLibrary,
      upsertCachedNote,
      refreshKey
    ]
  )

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  )
}

export function useLibrary() {
  const context = useContext(LibraryContext)
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider')
  }

  return context
}
