'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  IconFile as FileIcon,
  IconFileText as FileText,
  IconPhoto as Photo
} from '@tabler/icons-react'
import { toast } from 'sonner'

import type { LibraryFileItem } from '@/lib/actions/files'
import { searchFiles } from '@/lib/actions/files'
import { listFiles } from '@/lib/actions/files'
import { listNotes, searchNotes } from '@/lib/actions/notes'
import { captureClient } from '@/lib/analytics/posthog-client'
import type { Note } from '@/lib/db/schema'
import type { NoteContext, UploadedFile } from '@/lib/types'
import { stripMarkdownText } from '@/lib/utils/markdown'

import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Spinner } from '@/components/ui/spinner'

import { useLibrary } from './library-context'

type LibraryFilter = 'all' | 'notes' | 'files'
const PICKER_SEARCH_DEBOUNCE_MS = 120
const SERVER_SEARCH_MIN_CHARS = 2

function filterCachedNotes(notes: Note[], query: string) {
  const normalizedQuery = query.toLowerCase()
  return notes
    .filter(note => {
      const title = stripMarkdownText(note.title).toLowerCase()
      const content = stripMarkdownText(note.content).toLowerCase()
      return (
        title.includes(normalizedQuery) || content.includes(normalizedQuery)
      )
    })
    .slice(0, 12)
}

function filterCachedFiles(files: LibraryFileItem[], query: string) {
  const normalizedQuery = query.toLowerCase()
  return files
    .filter(file => {
      return (
        file.filename.toLowerCase().includes(normalizedQuery) ||
        file.mediaType.toLowerCase().includes(normalizedQuery)
      )
    })
    .slice(0, 12)
}

function fileIcon(file: LibraryFileItem) {
  if (file.mediaType.startsWith('image/')) return Photo
  return FileIcon
}

function toUploadedFile(file: LibraryFileItem): UploadedFile {
  return {
    status: 'uploaded',
    url: file.url,
    key: file.key,
    name: file.filename,
    mediaType: file.mediaType,
    libraryFileId: file.id
  }
}

export function LibraryPickerDialog({
  open,
  onOpenChange,
  onAttachNote,
  onAttachFile
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAttachNote: (note: NoteContext) => boolean
  onAttachFile: (file: UploadedFile) => boolean
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [notes, setNotes] = useState<Note[]>([])
  const [files, setFiles] = useState<LibraryFileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const requestSeqRef = useRef(0)
  const {
    notesCache,
    filesCache,
    replaceNotesCache,
    replaceFilesCache,
    refreshKey
  } = useLibrary()

  useEffect(() => {
    if (!open) {
      requestSeqRef.current += 1
      queueMicrotask(() => setIsLoading(false))
      return
    }

    const seq = ++requestSeqRef.current
    const trimmed = query.trim()
    const shouldLoadNotes = filter === 'all' || filter === 'notes'
    const shouldLoadFiles = filter === 'all' || filter === 'files'
    const cachedNotes = notesCache?.notes ?? []
    const cachedFiles = filesCache?.files ?? []
    const cachedResultNotes =
      shouldLoadNotes && trimmed
        ? filterCachedNotes(cachedNotes, trimmed)
        : shouldLoadNotes
          ? cachedNotes.slice(0, 12)
          : []
    const cachedResultFiles =
      shouldLoadFiles && trimmed
        ? filterCachedFiles(cachedFiles, trimmed)
        : shouldLoadFiles
          ? cachedFiles.slice(0, 12)
          : []

    const needsNotesFetch =
      shouldLoadNotes &&
      (!notesCache || trimmed.length >= SERVER_SEARCH_MIN_CHARS)
    const needsFilesFetch =
      shouldLoadFiles &&
      (!filesCache || trimmed.length >= SERVER_SEARCH_MIN_CHARS)

    queueMicrotask(() => {
      if (seq !== requestSeqRef.current) return

      setNotes(cachedResultNotes)
      setFiles(cachedResultFiles)
      setIsLoading(
        (needsNotesFetch || needsFilesFetch) &&
          cachedResultNotes.length === 0 &&
          cachedResultFiles.length === 0
      )
    })

    if (!needsNotesFetch && !needsFilesFetch) {
      return
    }

    const timeout = setTimeout(async () => {
      const emptyNotesResult: Awaited<ReturnType<typeof listNotes>> = {
        success: true,
        notes: []
      }
      const emptyFilesResult: Awaited<ReturnType<typeof listFiles>> = {
        success: true,
        files: []
      }

      const [notesResult, filesResult] = await Promise.all([
        needsNotesFetch
          ? trimmed
            ? searchNotes({ query: trimmed, limit: 12 })
            : listNotes({ limit: 12 })
          : Promise.resolve(emptyNotesResult),
        needsFilesFetch
          ? trimmed
            ? searchFiles({ query: trimmed, limit: 12 })
            : listFiles({ limit: 12 })
          : Promise.resolve(emptyFilesResult)
      ])

      if (seq !== requestSeqRef.current) return

      setIsLoading(false)

      if (!notesResult.success) {
        toast.error(notesResult.error ?? 'Failed to load notes')
      }
      if (!filesResult.success) {
        toast.error(filesResult.error ?? 'Failed to load files')
      }

      if (needsNotesFetch) {
        setNotes(notesResult.notes ?? [])
      }
      if (needsFilesFetch) {
        setFiles(filesResult.files ?? [])
      }

      if (!trimmed && notesResult.success && needsNotesFetch) {
        const notesPage = notesResult as Awaited<ReturnType<typeof listNotes>>
        replaceNotesCache({
          notes: notesPage.notes ?? [],
          nextCursor: notesPage.nextCursor ?? null,
          hasMore: Boolean(notesPage.hasMore)
        })
      }
      if (!trimmed && filesResult.success && needsFilesFetch) {
        const filesPage = filesResult as Awaited<ReturnType<typeof listFiles>>
        replaceFilesCache({
          files: filesPage.files ?? [],
          nextCursor: filesPage.nextCursor ?? null,
          hasMore: Boolean(filesPage.hasMore)
        })
      }
    }, PICKER_SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [
    filesCache,
    filter,
    notesCache,
    open,
    query,
    replaceFilesCache,
    replaceNotesCache,
    refreshKey
  ])

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setQuery('')
      setFilter('all')
      setIsLoading(false)
      requestAnimationFrame(() => {
        if (!document.querySelector('[role="dialog"][data-state="open"]')) {
          document.body.style.pointerEvents = ''
        }
      })
    }
  }

  const empty = notes.length === 0 && files.length === 0
  const heading = useMemo(() => {
    if (query.trim()) return 'Search results'
    return 'Recent library items'
  }, [query])

  function handleAttachNote(note: Note) {
    const attached = onAttachNote({
      id: note.id,
      title: note.title,
      content: note.content
    })
    if (attached) {
      captureClient('note_context_attached', {
        source: 'picker',
        noteId: note.id,
        chars: note.content.length
      })
    }
    handleOpenChange(false)
  }

  function handleAttachFile(file: LibraryFileItem) {
    const attached = onAttachFile(toUploadedFile(file))
    if (attached) {
      captureClient('library_file_attached', {
        source: 'picker',
        fileId: file.id,
        mediaType: file.mediaType
      })
    }
    handleOpenChange(false)
  }

  return (
    <CommandDialog modal={false} open={open} onOpenChange={handleOpenChange}>
      <div className="flex items-center gap-1 border-b px-3 py-2">
        {(['all', 'notes', 'files'] as const).map(value => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? 'secondary' : 'ghost'}
            className="h-7 rounded-md px-2 text-xs capitalize"
            onClick={() => setFilter(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search notes and files..."
      />
      <CommandList className="h-[420px] max-h-[calc(100vh-14rem)]">
        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Spinner /> Loading library
          </div>
        )}
        {!isLoading && empty && (
          <CommandEmpty>No library items found.</CommandEmpty>
        )}
        {!isLoading && !empty && (
          <CommandGroup heading={heading}>
            {notes.map(note => (
              <CommandItem
                key={`note-${note.id}`}
                value={`note-${note.id}-${stripMarkdownText(note.title)}`}
                onSelect={() => handleAttachNote(note)}
              >
                <FileText className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {stripMarkdownText(note.title) || 'Untitled note'}
                  </p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {stripMarkdownText(note.content)}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  Note
                </span>
              </CommandItem>
            ))}
            {files.map(file => {
              const Icon = fileIcon(file)
              return (
                <CommandItem
                  key={`file-${file.id}`}
                  value={`file-${file.id}-${file.filename}`}
                  onSelect={() => handleAttachFile(file)}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {file.filename}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {file.mediaType}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    File
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
