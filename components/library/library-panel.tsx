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
  IconFile as FileIcon,
  IconFileText as FileText,
  IconLibrary as LibraryIcon,
  IconPhoto as Photo,
  IconTrash as Trash,
  IconX as X
} from '@tabler/icons-react'
import { toast } from 'sonner'

import type { LibraryFileItem } from '@/lib/actions/files'
import { deleteFile, listFiles } from '@/lib/actions/files'
import { deleteNote, listNotes } from '@/lib/actions/notes'
import { captureClient } from '@/lib/analytics/posthog-client'
import type { Note } from '@/lib/db/schema'
import { stripMarkdownText } from '@/lib/utils/markdown'

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

type LibraryTab = 'all' | 'notes' | 'files'
type DeleteTarget =
  | { kind: 'note'; item: Note; source: 'library_list' | 'library_detail' }
  | {
      kind: 'file'
      item: LibraryFileItem
      source: 'library_list' | 'library_detail'
    }

function formatNoteDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function getExcerpt(content: string) {
  return stripMarkdownText(content).slice(0, 140)
}

function formatBytes(value: number | null) {
  if (!value) return 'Unknown size'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function stripMarkdownTitle(value: string) {
  return stripMarkdownText(value)
}

function fileIcon(file: LibraryFileItem) {
  return file.mediaType.startsWith('image/') ? Photo : FileIcon
}

function LibraryItemActionsMenu({
  deleteLabel,
  onDelete
}: {
  deleteLabel: string
  onDelete: () => void
}) {
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
          {deleteLabel}
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
    filesCache,
    refreshKey,
    replaceNotesCache,
    replaceFilesCache,
    appendNotesCache,
    removeCachedNote,
    removeCachedFile
  } = useLibrary()
  const [activeTab, setActiveTab] = useState<LibraryTab>('all')
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [selectedFile, setSelectedFile] = useState<LibraryFileItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [hasLoadAttempted, setHasLoadAttempted] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const lastFetchedRefreshKeyRef = useRef<number | null>(null)
  const lastFetchedFilesRefreshKeyRef = useRef<number | null>(null)
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

  useEffect(() => {
    if (!isOpen) return

    const hasCache = Boolean(filesCache)
    const isRefreshStale = lastFetchedFilesRefreshKeyRef.current !== refreshKey
    const isTimeStale =
      !filesCache || Date.now() - filesCache.updatedAt > LIBRARY_CACHE_TTL_MS

    if (hasCache && !isRefreshStale && !isTimeStale) {
      return
    }

    const loadReason = !hasCache ? 'cold' : isRefreshStale ? 'refresh' : 'ttl'
    let cancelled = false
    listFiles({ limit: LIBRARY_PAGE_SIZE }).then(result => {
      if (cancelled) return

      if (!result.success) {
        captureClient('library_files_load_failed', {
          source: 'network',
          reason: loadReason,
          error: result.error ?? 'unknown'
        })
        toast.error(result.error ?? 'Failed to load files')
        return
      }

      const nextFiles = result.files ?? []
      replaceFilesCache({
        files: nextFiles,
        nextCursor: result.nextCursor ?? null,
        hasMore: Boolean(result.hasMore)
      })
      lastFetchedFilesRefreshKeyRef.current = refreshKey
      captureClient('library_files_loaded', {
        source: 'network',
        reason: loadReason,
        fileCount: nextFiles.length,
        isEmpty: nextFiles.length === 0
      })
    })

    return () => {
      cancelled = true
    }
  }, [filesCache, isOpen, refreshKey, replaceFilesCache])

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

  const visibleNotes = useMemo(() => notesCache?.notes ?? [], [notesCache])
  const visibleFiles = useMemo(() => filesCache?.files ?? [], [filesCache])
  const isLoading = !notesCache && !hasLoadAttempted
  const isFilesLoading = !filesCache
  const isActiveTabLoading =
    activeTab === 'notes'
      ? isLoading
      : activeTab === 'files'
        ? isFilesLoading
        : isLoading || isFilesLoading
  const emptyMessage =
    activeTab === 'notes'
      ? 'No notes yet.'
      : activeTab === 'files'
        ? 'No files yet.'
        : 'No library items yet.'
  const selectedTitle = useMemo(
    () =>
      selectedNote
        ? stripMarkdownTitle(selectedNote.title)
        : selectedFile?.filename || '',
    [selectedFile?.filename, selectedNote]
  )
  const hasSelectedItem = Boolean(selectedNote || selectedFile)
  const visibleLibraryItems = useMemo(() => {
    const noteItems = visibleNotes.map(note => ({
      kind: 'note' as const,
      item: note,
      updatedAt: note.updatedAt
    }))
    const fileItems = visibleFiles.map(file => ({
      kind: 'file' as const,
      item: file,
      updatedAt: file.updatedAt
    }))

    return [
      ...(activeTab === 'files' ? [] : noteItems),
      ...(activeTab === 'notes' ? [] : fileItems)
    ].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [activeTab, visibleFiles, visibleNotes])

  function handleOpenNote(note: Note) {
    setSelectedNote(note)
    setSelectedFile(null)
    captureClient('note_opened', {
      source: 'library_list',
      noteId: note.id,
      noteCount: visibleNotes.length
    })
  }

  function handleOpenFile(file: LibraryFileItem) {
    setSelectedFile(file)
    setSelectedNote(null)
    captureClient('library_file_opened', {
      source: 'library_list',
      fileId: file.id,
      mediaType: file.mediaType,
      fileCount: visibleFiles.length
    })
  }

  function handleCloseLibrary(source: 'panel_header' | 'detail_header') {
    closeLibrary()
    captureClient('library_closed', { source, tab: activeTab })
  }

  function handleRequestDeleteNote(
    note: Note,
    source: 'library_list' | 'library_detail'
  ) {
    setDeleteTarget({ kind: 'note', item: note, source })
    captureClient('note_delete_requested', { source, noteId: note.id })
  }

  function handleRequestDeleteFile(
    file: LibraryFileItem,
    source: 'library_list' | 'library_detail'
  ) {
    setDeleteTarget({ kind: 'file', item: file, source })
    captureClient('library_file_delete_requested', {
      source,
      fileId: file.id,
      mediaType: file.mediaType
    })
  }

  function handleDeleteItem() {
    if (!deleteTarget) return

    const target = deleteTarget
    setDeleteTarget(null)
    startDeleteTransition(async () => {
      const result =
        target.kind === 'note'
          ? await deleteNote(target.item.id)
          : await deleteFile(target.item.id)
      if (!result.success) {
        captureClient(
          target.kind === 'note'
            ? 'note_delete_failed'
            : 'library_file_delete_failed',
          {
            itemId: target.item.id,
            reason: result.error ?? 'unknown'
          }
        )
        toast.error(result.error ?? 'Failed to delete item')
        return
      }

      captureClient(
        target.kind === 'note' ? 'note_deleted' : 'library_file_deleted',
        { itemId: target.item.id }
      )
      toast.success(
        target.kind === 'note' ? 'Note deleted' : 'File removed from Library'
      )
      if (target.kind === 'note' && selectedNote?.id === target.item.id) {
        setSelectedNote(null)
      } else if (
        target.kind === 'file' &&
        selectedFile?.id === target.item.id
      ) {
        setSelectedFile(null)
      }
      if (target.kind === 'note') {
        removeCachedNote(target.item.id)
      } else {
        removeCachedFile(target.item.id)
      }
    })
  }

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted md:px-4 md:pt-14 md:pb-4">
        <div className="flex h-full flex-col overflow-hidden bg-background md:rounded-xl md:border">
          <div className="flex items-center justify-between px-4 py-2">
            {hasSelectedItem ? (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <TooltipButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => {
                      setSelectedNote(null)
                      setSelectedFile(null)
                    }}
                    aria-label="Back to library"
                    tooltipContent="Back"
                  >
                    <ArrowLeft className="size-4" />
                  </TooltipButton>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">
                      {selectedTitle || 'Untitled item'}
                    </h3>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {selectedNote && (
                    <LibraryItemActionsMenu
                      deleteLabel="Delete Note"
                      onDelete={() =>
                        handleRequestDeleteNote(selectedNote, 'library_detail')
                      }
                    />
                  )}
                  {selectedFile && (
                    <LibraryItemActionsMenu
                      deleteLabel="Remove from Library"
                      onDelete={() =>
                        handleRequestDeleteFile(selectedFile, 'library_detail')
                      }
                    />
                  )}
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
          ) : selectedFile ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div
                data-vaul-no-drag
                className="min-h-0 flex-1 overflow-y-auto p-4"
              >
                {selectedFile.mediaType.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedFile.url}
                    alt={selectedFile.filename}
                    className="max-h-[48vh] w-full rounded-md border object-contain"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-md border bg-muted/40">
                    <FileIcon className="size-10 text-muted-foreground" />
                  </div>
                )}
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Filename</p>
                    <p className="break-words font-medium">
                      {selectedFile.filename}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="mt-0.5 break-words">
                        {selectedFile.mediaType}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Size</p>
                      <p className="mt-0.5">{formatBytes(selectedFile.size)}</p>
                    </div>
                  </div>
                </div>
              </div>
              <footer className="shrink-0 border-t px-4 py-2 text-xs text-muted-foreground">
                Added {formatNoteDate(selectedFile.createdAt)}
              </footer>
            </div>
          ) : (
            <div
              ref={listScrollRef}
              data-vaul-no-drag
              className="min-h-0 flex-1 overflow-y-auto p-2"
            >
              <div className="mb-2 flex gap-1 px-1">
                {(['all', 'notes', 'files'] as const).map(tab => (
                  <Button
                    key={tab}
                    type="button"
                    size="sm"
                    variant={activeTab === tab ? 'secondary' : 'ghost'}
                    className="h-7 rounded-md px-2 text-xs capitalize"
                    onClick={() => {
                      setActiveTab(tab)
                      captureClient('library_tab_selected', { tab })
                    }}
                  >
                    {tab}
                  </Button>
                ))}
              </div>
              {isActiveTabLoading ? (
                <LibraryLoadingSkeleton />
              ) : visibleLibraryItems.length === 0 ? (
                <div className="px-4 py-8 text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : (
                <div className="space-y-1">
                  {visibleLibraryItems.map(libraryItem => {
                    if (libraryItem.kind === 'file') {
                      const file = libraryItem.item
                      const Icon = fileIcon(file)
                      return (
                        <div
                          key={`file-${file.id}`}
                          className="group/note relative rounded-md hover:bg-accent"
                        >
                          <button
                            type="button"
                            className="w-full rounded-md px-3 py-2 pr-10 text-left text-sm transition-colors"
                            onClick={() => handleOpenFile(file)}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate font-medium">
                                {file.filename}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {file.mediaType} · {formatBytes(file.size)}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground/75">
                              {formatNoteDate(file.updatedAt)}
                            </p>
                          </button>
                          <div className="absolute right-1 top-1.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover/note:opacity-100">
                            <LibraryItemActionsMenu
                              deleteLabel="Remove from Library"
                              onDelete={() =>
                                handleRequestDeleteFile(file, 'library_list')
                              }
                            />
                          </div>
                        </div>
                      )
                    }

                    const note = libraryItem.item
                    const title =
                      stripMarkdownTitle(note.title) || 'Untitled note'
                    return (
                      <div
                        key={`note-${note.id}`}
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
                          <LibraryItemActionsMenu
                            deleteLabel="Delete Note"
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
            <AlertDialogTitle>
              {deleteTarget?.kind === 'file'
                ? 'Remove this file from Library?'
                : `Delete this ${deleteTarget?.kind ?? 'item'}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === 'file'
                ? 'This removes the file from Library. Existing chat history and stored attachments are not deleted.'
                : 'This action cannot be undone. The saved item will be permanently removed from your library.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={event => {
                event.preventDefault()
                handleDeleteItem()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <div className="flex items-center justify-center">
                  <Spinner />
                </div>
              ) : deleteTarget?.kind === 'file' ? (
                'Remove'
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
