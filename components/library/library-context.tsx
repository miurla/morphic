'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react'

import type { LibraryFileItem } from '@/lib/actions/files'
import type { Note } from '@/lib/db/schema'

import { useSidebar } from '../ui/sidebar'

type NotesListCursor = {
  updatedAt: string
  id: string
}

type NotesCache = {
  notes: Note[]
  nextCursor: NotesListCursor | null
  hasMore: boolean
  updatedAt: number
}

type FilesCache = {
  files: LibraryFileItem[]
  nextCursor: NotesListCursor | null
  hasMore: boolean
  updatedAt: number
}

type LibraryContextValue = {
  isOpen: boolean
  notesCache: NotesCache | null
  filesCache: FilesCache | null
  refreshKey: number
  openLibrary: () => void
  closeLibrary: () => void
  toggleLibrary: () => void
  replaceNotesCache: (page: {
    notes: Note[]
    nextCursor: NotesListCursor | null
    hasMore: boolean
  }) => void
  appendNotesCache: (page: {
    notes: Note[]
    nextCursor: NotesListCursor | null
    hasMore: boolean
  }) => void
  upsertCachedNote: (note: Note) => void
  removeCachedNote: (noteId: string) => void
  replaceFilesCache: (page: {
    files: LibraryFileItem[]
    nextCursor: NotesListCursor | null
    hasMore: boolean
  }) => void
  upsertCachedFile: (file: LibraryFileItem) => void
  removeCachedFile: (fileId: string) => void
  refreshLibrary: () => void
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notesCache, setNotesCache] = useState<NotesCache | null>(null)
  const [filesCache, setFilesCache] = useState<FilesCache | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const { setOpen: setSidebarOpen } = useSidebar()

  const openLibrary = useCallback(() => {
    setSidebarOpen(false)
    setIsOpen(true)
  }, [setSidebarOpen])
  const closeLibrary = useCallback(() => setIsOpen(false), [])
  const toggleLibrary = useCallback(() => {
    if (!isOpen) {
      setSidebarOpen(false)
    }
    setIsOpen(open => !open)
  }, [isOpen, setSidebarOpen])
  const replaceNotesCache = useCallback(
    (page: {
      notes: Note[]
      nextCursor: NotesListCursor | null
      hasMore: boolean
    }) => {
      setNotesCache({ ...page, updatedAt: Date.now() })
    },
    []
  )
  const appendNotesCache = useCallback(
    (page: {
      notes: Note[]
      nextCursor: NotesListCursor | null
      hasMore: boolean
    }) => {
      setNotesCache(cache => {
        if (!cache) {
          return { ...page, updatedAt: Date.now() }
        }

        const existingIds = new Set(cache.notes.map(note => note.id))
        const mergedNotes = [
          ...cache.notes,
          ...page.notes.filter(note => !existingIds.has(note.id))
        ]

        return {
          notes: mergedNotes,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          updatedAt: Date.now()
        }
      })
    },
    []
  )
  const upsertCachedNote = useCallback((note: Note) => {
    setNotesCache(cache => {
      if (!cache) return cache

      return {
        notes: [note, ...cache.notes.filter(item => item.id !== note.id)],
        nextCursor: cache.nextCursor,
        hasMore: cache.hasMore,
        updatedAt: Date.now()
      }
    })
  }, [])
  const removeCachedNote = useCallback((noteId: string) => {
    setNotesCache(cache => {
      if (!cache) return cache

      return {
        notes: cache.notes.filter(note => note.id !== noteId),
        nextCursor: cache.nextCursor,
        hasMore: cache.hasMore,
        updatedAt: Date.now()
      }
    })
  }, [])
  const replaceFilesCache = useCallback(
    (page: {
      files: LibraryFileItem[]
      nextCursor: NotesListCursor | null
      hasMore: boolean
    }) => {
      setFilesCache({ ...page, updatedAt: Date.now() })
    },
    []
  )
  const upsertCachedFile = useCallback((file: LibraryFileItem) => {
    setFilesCache(cache => {
      if (!cache) return cache

      return {
        files: [file, ...cache.files.filter(item => item.id !== file.id)],
        nextCursor: cache.nextCursor,
        hasMore: cache.hasMore,
        updatedAt: Date.now()
      }
    })
  }, [])
  const removeCachedFile = useCallback((fileId: string) => {
    setFilesCache(cache => {
      if (!cache) return cache

      return {
        files: cache.files.filter(file => file.id !== fileId),
        nextCursor: cache.nextCursor,
        hasMore: cache.hasMore,
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
      filesCache,
      refreshKey,
      openLibrary,
      closeLibrary,
      toggleLibrary,
      replaceNotesCache,
      appendNotesCache,
      upsertCachedNote,
      removeCachedNote,
      replaceFilesCache,
      upsertCachedFile,
      removeCachedFile,
      refreshLibrary
    }),
    [
      closeLibrary,
      appendNotesCache,
      isOpen,
      filesCache,
      notesCache,
      openLibrary,
      removeCachedNote,
      removeCachedFile,
      replaceFilesCache,
      replaceNotesCache,
      refreshLibrary,
      toggleLibrary,
      upsertCachedFile,
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
