'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  FolderInput,
  MoreHorizontal,
  Plus,
  Search,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'

import { deleteChat } from '@/lib/actions/chat'
import { Chat as DBChat } from '@/lib/db/schema'

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
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

import { AssignProjectDialog } from '@/components/assign-project-dialog'

interface ChatPageResponse {
  chats: DBChat[]
  nextOffset: number | null
}

function getRelativeTime(date: Date | string): string {
  const parsed = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - parsed.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Last message today'
  if (diffDays === 1) return 'Last message yesterday'
  if (diffDays < 30) return `Last message ${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return 'Last message 1 month ago'
  if (diffMonths < 12) return `Last message ${diffMonths} months ago`
  const diffYears = Math.floor(diffDays / 365)
  if (diffYears === 1) return 'Last message 1 year ago'
  return `Last message ${diffYears} years ago`
}

interface ChatsPageClientProps {
  userName: string | null
}

export function ChatsPageClient({ userName }: ChatsPageClientProps) {
  const [chats, setChats] = useState<DBChat[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<DBChat | null>(null)
  const [isPending, startTransition] = useTransition()
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const fetchInitialChats = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats?offset=0&limit=50`)
      if (!response.ok) throw new Error('Failed to fetch chats')
      const { chats: dbChats, nextOffset: newNextOffset } =
        (await response.json()) as ChatPageResponse
      setChats(dbChats)
      setNextOffset(newNextOffset)
    } catch {
      toast.error('Failed to load chats.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInitialChats()
  }, [fetchInitialChats])

  useEffect(() => {
    const handler = () => startTransition(() => fetchInitialChats())
    window.addEventListener('chat-history-updated', handler)
    return () => window.removeEventListener('chat-history-updated', handler)
  }, [fetchInitialChats])

  const fetchMore = useCallback(async () => {
    if (isLoading || nextOffset === null) return
    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats?offset=${nextOffset}&limit=50`)
      if (!response.ok) throw new Error('Failed to fetch more chats')
      const { chats: dbChats, nextOffset: newNextOffset } =
        (await response.json()) as ChatPageResponse
      setChats(prev => [...prev, ...dbChats])
      setNextOffset(newNextOffset)
    } catch {
      toast.error('Failed to load more chats.')
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, nextOffset])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || nextOffset === null) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoading) fetchMore()
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.unobserve(el)
  }, [fetchMore, nextOffset, isLoading])

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleCancelSelect = () => {
    setIsSelecting(false)
    setSelectedIds(new Set())
  }

  const handleDeleteSelected = useCallback(() => {
    startTransition(async () => {
      const ids = Array.from(selectedIds)
      const results = await Promise.all(ids.map(id => deleteChat(id)))
      const failed = results.filter(r => !r?.success).length
      if (failed > 0) {
        toast.error(`Failed to delete ${failed} chat(s).`)
      } else {
        toast.success(`Deleted ${ids.length} chat${ids.length > 1 ? 's' : ''}.`)
      }
      setSelectedIds(new Set())
      setIsSelecting(false)
      setDeleteDialogOpen(false)
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
      router.refresh()
    })
  }, [selectedIds, router])

  const displayName = userName ? `${userName}'s` : 'Your'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl">Chats</h1>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href="/">
              <Plus className="size-4" />
              New chat
            </Link>
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search your chats..."
            className="pl-9 bg-muted/50 border-transparent focus-visible:border-border"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Section header */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">
            {displayName} chats with Borsatti&apos;s
          </p>
          {chats.length > 0 && (
            <button
              onClick={() =>
                isSelecting ? handleCancelSelect() : setIsSelecting(true)
              }
              className="text-sm text-primary hover:underline"
            >
              {isSelecting ? 'Cancel' : 'Select'}
            </button>
          )}
        </div>

        {/* Delete selected toolbar */}
        {isSelecting && selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 mb-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5 h-7"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        )}

        {isLoading && chats.length === 0 ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            {searchQuery ? 'No chats match your search.' : 'No chats yet.'}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border overflow-hidden">
            {filteredChats.map(chat => (
              <div key={chat.id} className="group flex items-center">
                {isSelecting && (
                  <div className="pl-3 py-3">
                    <Checkbox
                      checked={selectedIds.has(chat.id)}
                      onCheckedChange={() => toggleSelect(chat.id)}
                      aria-label={`Select chat: ${chat.title}`}
                    />
                  </div>
                )}
                <Link
                  href={`/search/${chat.id}`}
                  className="flex-1 px-4 py-3 hover:bg-muted/50 transition-colors min-w-0"
                  onClick={e => {
                    if (isSelecting) {
                      e.preventDefault()
                      toggleSelect(chat.id)
                    }
                  }}
                >
                  <div className="font-medium text-sm truncate">
                    {chat.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {getRelativeTime(chat.createdAt)}
                  </div>
                </Link>
                {!isSelecting && (
                  <div className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={e => e.preventDefault()}
                        >
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Chat actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={e => {
                            e.preventDefault()
                            setAssignTarget(chat)
                          }}
                        >
                          <FolderInput className="size-3.5" />
                          {chat.projectId
                            ? 'Move to project'
                            : 'Add to project'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onSelect={e => {
                            e.preventDefault()
                            startTransition(async () => {
                              const result = await deleteChat(chat.id)
                              if (result?.success) {
                                toast.success('Chat deleted.')
                                window.dispatchEvent(
                                  new CustomEvent('chat-history-updated')
                                )
                                setChats(prev =>
                                  prev.filter(c => c.id !== chat.id)
                                )
                              } else {
                                toast.error(
                                  result?.error ?? 'Failed to delete chat.'
                                )
                              }
                            })
                          }}
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div ref={loadMoreRef} style={{ height: '1px' }} />
        {isLoading && chats.length > 0 && (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}
      </div>

      {/* Assign to project dialog */}
      {assignTarget && (
        <AssignProjectDialog
          open={!!assignTarget}
          onOpenChange={open => !open && setAssignTarget(null)}
          chatId={assignTarget.id}
          currentProjectId={assignTarget.projectId}
          onAssigned={projectId => {
            setChats(prev =>
              prev.map(c =>
                c.id === assignTarget.id ? { ...c, projectId } : c
              )
            )
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} chat{selectedIds.size > 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected chat
              {selectedIds.size > 1 ? 's' : ''} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={e => {
                e.preventDefault()
                handleDeleteSelected()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? <Spinner /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
