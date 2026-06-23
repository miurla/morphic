'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'

import {
  IconArrowLeft as ArrowLeft,
  IconDots as MoreHorizontal,
  IconFileText as FileText,
  IconLibrary as LibraryIcon,
  IconTrash as Trash,
  IconX as X
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { deleteNote, listNotes } from '@/lib/actions/notes'
import { captureClient } from '@/lib/analytics/posthog-client'
import type { Note } from '@/lib/db/schema'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TooltipButton } from '@/components/ui/tooltip-button'

import { MarkdownMessage } from '@/components/message'

import { useLibrary } from './library-context'

const LIBRARY_CACHE_TTL_MS = 60_000
const LIBRARY_PAGE_SIZE = 25

function formatNoteDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function stripMarkdownText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, match =>
      match.replace(/```[^\n]*\n?|\n?```/g, ' ')
    )
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/[*_~`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getExcerpt(content: string) {
  return stripMarkdownText(content).slice(0, 140)
}

function stripMarkdownTitle(value: string) {
  return stripMarkdownText(value)
}

function NoteActionsMenu({ onDelete }: { onDelete: () => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          onClick={event => event.stopPropagation()}
          aria-label="Note actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left" align="start">
        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive"
          onSelect={event => {
            event.preventDefault()
            setIsMenuOpen(false)
            onDelete()
          }}
        >
          <Trash size={14} />
          Delete Note
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LibraryLoadingSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-md px-3 py-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-3.5 shrink-0 rounded-sm" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-1 h-3 w-4/5" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export function LibraryPanel() {
  const {
    isOpen,
    closeLibrary,
    notesCache,
    refreshKey,
    replaceNotesCache,
    appendNotesCache,
    removeCachedNote
  } = useLibrary()
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const [hasLoadAttempted, setHasLoadAttempted] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const lastFetchedRefreshKeyRef = useRef<number | null>(null)
  const previousIsOpenRef = useRef(false)
  const listScrollRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const justOpened = isOpen && !previousIsOpenRef.current
    previousIsOpenRef.current = isOpen

    if (!justOpened || !notesCache) return

    captureClient('library_list_loaded', {
      source: 'cache',
      noteCount: notesCache.notes.length,
      isEmpty: notesCache.notes.length === 0,
      cacheAgeMs: Date.now() - notesCache.updatedAt
    })
  }, [isOpen, notesCache])

  useEffect(() => {
    if (!isOpen) return

    const hasCache = Boolean(notesCache)
    const isRefreshStale = lastFetchedRefreshKeyRef.current !== refreshKey
    const isTimeStale =
      !notesCache || Date.now() - notesCache.updatedAt > LIBRARY_CACHE_TTL_MS

    if (hasCache && !isRefreshStale && !isTimeStale) {
      return
    }

    const loadReason = !hasCache ? 'cold' : isRefreshStale ? 'refresh' : 'ttl'
    let cancelled = false
    listNotes({ limit: LIBRARY_PAGE_SIZE }).then(result => {
      if (cancelled) return

      setHasLoadAttempted(true)

      if (!result.success) {
        captureClient('library_list_load_failed', {
          source: 'network',
          reason: loadReason,
          error: result.error ?? 'unknown'
        })
        toast.error(result.error ?? 'Failed to load library')
        return
      }

      const nextNotes = result.notes ?? []
      captureClient('library_list_loaded', {
        source: 'network',
        reason: loadReason,
        noteCount: nextNotes.length,
        hasMore: Boolean(result.hasMore),
        isEmpty: nextNotes.length === 0
      })
      replaceNotesCache({
        notes: nextNotes,
        nextCursor: result.nextCursor ?? null,
        hasMore: Boolean(result.hasMore)
      })
      lastFetchedRefreshKeyRef.current = refreshKey
      setSelectedNote(current => {
        if (!current) return current

        return nextNotes.find(note => note.id === current.id) ?? current
      })
    })

    return () => {
      cancelled = true
    }
  }, [isOpen, notesCache, refreshKey, replaceNotesCache])

  const handleLoadMore = useCallback(async () => {
    if (!notesCache?.hasMore || !notesCache.nextCursor || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const result = await listNotes({
        limit: LIBRARY_PAGE_SIZE,
        cursor: notesCache.nextCursor
      })

      if (!result.success) {
        captureClient('library_list_load_failed', {
          source: 'network',
          reason: 'load_more',
          error: result.error ?? 'unknown'
        })
        toast.error(result.error ?? 'Failed to load library')
        return
      }

      const nextNotes = result.notes ?? []
      appendNotesCache({
        notes: nextNotes,
        nextCursor: result.nextCursor ?? null,
        hasMore: Boolean(result.hasMore)
      })
      captureClient('library_list_loaded', {
        source: 'network',
        reason: 'load_more',
        noteCount: nextNotes.length,
        hasMore: Boolean(result.hasMore),
        isEmpty: nextNotes.length === 0
      })
    } finally {
      setIsLoadingMore(false)
    }
  }, [appendNotesCache, isLoadingMore, notesCache])

  useEffect(() => {
    if (!isOpen || selectedNote || !notesCache?.hasMore || isLoadingMore) return

    const sentinel = loadMoreRef.current
    const scrollRoot = listScrollRef.current
    if (!sentinel || !scrollRoot) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          void handleLoadMore()
        }
      },
      { root: scrollRoot, rootMargin: '160px 0px' }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [handleLoadMore, isLoadingMore, isOpen, notesCache?.hasMore, selectedNote])

  const visibleNotes = notesCache?.notes ?? []
  const isLoading = !notesCache && !hasLoadAttempted
  const selectedTitle = useMemo(
    () => stripMarkdownTitle(selectedNote?.title ?? ''),
    [selectedNote?.title]
  )

  function handleOpenNote(note: Note) {
    setSelectedNote(note)
    captureClient('note_opened', {
      source: 'library_list',
      noteId: note.id,
      noteCount: visibleNotes.length
    })
  }

  function handleCloseLibrary(source: 'panel_header' | 'detail_header') {
    closeLibrary()
    captureClient('library_closed', { source })
  }

  function handleRequestDeleteNote(
    note: Note,
    source: 'library_list' | 'library_detail'
  ) {
    setDeleteTarget(note)
    captureClient('note_delete_requested', { source, noteId: note.id })
  }

  function handleDeleteNote() {
    if (!deleteTarget) return

    const noteId = deleteTarget.id
    setDeleteTarget(null)
    startDeleteTransition(async () => {
      const result = await deleteNote(noteId)
      if (!result.success) {
        captureClient('note_delete_failed', {
          noteId,
          reason: result.error ?? 'unknown'
        })
        toast.error(result.error ?? 'Failed to delete note')
        return
      }

      captureClient('note_deleted', { noteId })
      toast.success('Note deleted')
      if (selectedNote?.id === noteId) {
        setSelectedNote(null)
      }
      removeCachedNote(noteId)
    })
  }

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted md:px-4 md:pt-14 md:pb-4">
        <div className="flex h-full flex-col overflow-hidden bg-background md:rounded-xl md:border">
          <div className="flex items-center justify-between px-4 py-2">
            {selectedNote ? (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <TooltipButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => setSelectedNote(null)}
                    aria-label="Back to library"
                    tooltipContent="Back"
                  >
                    <ArrowLeft className="size-4" />
                  </TooltipButton>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">
                      {selectedTitle || 'Untitled note'}
                    </h3>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <NoteActionsMenu
                    onDelete={() =>
                      handleRequestDeleteNote(selectedNote, 'library_detail')
                    }
                  />
                  <TooltipButton
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCloseLibrary('detail_header')}
                    aria-label="Close panel"
                    tooltipContent="Close"
                  >
                    <X className="size-4" />
                  </TooltipButton>
                </div>
              </>
            ) : (
              <>
                <h3 className="flex min-w-0 items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md p-2">
                    <LibraryIcon size={18} />
                  </div>
                  <span className="truncate text-sm font-medium">Library</span>
                </h3>
                <TooltipButton
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCloseLibrary('panel_header')}
                  aria-label="Close panel"
                  tooltipContent="Close"
                >
                  <X className="size-4" />
                </TooltipButton>
              </>
            )}
          </div>
          <Separator className="my-1 bg-border/50" />

          {selectedNote ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <article
                data-vaul-no-drag
                className="min-h-0 flex-1 overflow-y-auto p-4"
              >
                <MarkdownMessage message={selectedNote.content} />
              </article>
              <footer className="shrink-0 border-t px-4 py-2 text-xs text-muted-foreground">
                Saved {formatNoteDate(selectedNote.createdAt)}
              </footer>
            </div>
          ) : (
            <div
              ref={listScrollRef}
              data-vaul-no-drag
              className="min-h-0 flex-1 overflow-y-auto p-2"
            >
              {isLoading ? (
                <LibraryLoadingSkeleton />
              ) : visibleNotes.length === 0 ? (
                <div className="px-4 py-8 text-sm text-muted-foreground">
                  No saved notes yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {visibleNotes.map(note => {
                    const title =
                      stripMarkdownTitle(note.title) || 'Untitled note'
                    return (
                      <div
                        key={note.id}
                        className="group/note relative rounded-md hover:bg-accent"
                      >
                        <button
                          type="button"
                          className="w-full rounded-md px-3 py-2 pr-10 text-left text-sm transition-colors"
                          onClick={() => handleOpenNote(note)}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate font-medium">
                              {title}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {getExcerpt(note.content)}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground/75">
                            {formatNoteDate(note.updatedAt)}
                          </p>
                        </button>
                        <div className="absolute right-1 top-1.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover/note:opacity-100">
                          <NoteActionsMenu
                            onDelete={() =>
                              handleRequestDeleteNote(note, 'library_list')
                            }
                          />
                        </div>
                      </div>
                    )
                  })}
                  {notesCache?.hasMore && (
                    <div
                      ref={loadMoreRef}
                      className="flex h-10 items-center justify-center text-muted-foreground"
                    >
                      {isLoadingMore && <Spinner />}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open && !isDeleting) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The saved note will be permanently
              deleted from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={event => {
                event.preventDefault()
                handleDeleteNote()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <div className="flex items-center justify-center">
                  <Spinner />
                </div>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
