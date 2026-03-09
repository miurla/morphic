'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  ArrowLeft,
  ChevronRight,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X
} from 'lucide-react'
import { toast } from 'sonner'

import { updateChatProject, updateProject } from '@/lib/actions/project'
import { Chat as DBChat, Project } from '@/lib/db/schema'

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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

interface ProjectDetailClientProps {
  project: Project
  chats: DBChat[]
}

function getRelativeTime(date: Date | string): string {
  const parsed = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - parsed.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return '1 month ago'
  if (diffMonths < 12) return `${diffMonths} months ago`
  const diffYears = Math.floor(diffDays / 365)
  return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`
}

export function ProjectDetailClient({
  project: initialProject,
  chats: initialChats
}: ProjectDetailClientProps) {
  const [project, setProject] = useState(initialProject)
  const [chats, setChats] = useState(initialChats)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Edit project name
  const [editNameOpen, setEditNameOpen] = useState(false)
  const [editName, setEditName] = useState(project.name)

  // Edit instructions
  const [editInstructionsOpen, setEditInstructionsOpen] = useState(false)
  const [editInstructions, setEditInstructions] = useState(
    project.instructions ?? ''
  )

  // Delete project
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)

  // Remove chat from project
  const [removeChatTarget, setRemoveChatTarget] = useState<DBChat | null>(null)

  const handleSaveName = useCallback(() => {
    if (!editName.trim()) return
    startTransition(async () => {
      const result = await updateProject(project.id, { name: editName.trim() })
      if (result.success && result.project) {
        setProject(result.project)
        setEditNameOpen(false)
        toast.success('Project renamed.')
      } else {
        toast.error('Failed to rename project.')
      }
    })
  }, [project.id, editName])

  const handleSaveInstructions = useCallback(() => {
    startTransition(async () => {
      const result = await updateProject(project.id, {
        instructions: editInstructions.trim() || undefined
      })
      if (result.success && result.project) {
        setProject(result.project)
        setEditInstructionsOpen(false)
        toast.success('Instructions saved.')
      } else {
        toast.error('Failed to save instructions.')
      }
    })
  }, [project.id, editInstructions])

  const handleDeleteProject = useCallback(() => {
    startTransition(async () => {
      try {
        await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
        toast.success('Project deleted.')
        router.push('/projects')
      } catch {
        toast.error('Failed to delete project.')
      }
    })
  }, [project.id, router])

  const handleRemoveChat = useCallback((chat: DBChat) => {
    startTransition(async () => {
      const result = await updateChatProject(chat.id, null)
      if (result.success) {
        setChats(prev => prev.filter(c => c.id !== chat.id))
        setRemoveChatTarget(null)
        toast.success('Chat removed from project.')
      } else {
        toast.error('Failed to remove chat.')
      }
    })
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          All projects
        </Link>

        <div className="flex items-start justify-between gap-2 mb-1">
          <h1 className="font-display text-2xl leading-tight">
            {project.name}
          </h1>
          <div className="flex items-center gap-1 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Project options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={e => {
                    e.preventDefault()
                    setEditName(project.name)
                    setEditNameOpen(true)
                  }}
                >
                  <Pencil className="size-3.5" />
                  Rename project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive"
                  onSelect={e => {
                    e.preventDefault()
                    setDeleteProjectOpen(true)
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {project.description && (
          <p className="text-sm text-muted-foreground mb-2">
            {project.description}
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-4">
        {/* New chat in project */}
        <Button asChild variant="outline" className="w-full gap-2">
          <Link href={`/?projectId=${project.id}`}>
            <Plus className="size-4" />
            New chat in this project
          </Link>
        </Button>

        {/* Chats list */}
        {chats.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
              Chats
            </p>
            <div className="rounded-xl border divide-y divide-border overflow-hidden">
              {chats.map(chat => (
                <div key={chat.id} className="group flex items-center">
                  <Link
                    href={`/search/${chat.id}`}
                    className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {chat.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getRelativeTime(chat.createdAt)}
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0 ml-2" />
                  </Link>
                  <button
                    onClick={() => setRemoveChatTarget(chat)}
                    className="pr-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    title="Remove from project"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            Start a chat to keep conversations organised and re-use project
            knowledge.
          </div>
        )}

        {/* Memory (placeholder) */}
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-sm">Memory</h2>
            <span className="inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 text-muted-foreground">
              <Lock className="size-3" />
              Only you
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Project memory will show here after a few chats.
          </p>
        </div>

        {/* Instructions */}
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-sm">Instructions</h2>
            <button
              onClick={() => {
                setEditInstructions(project.instructions ?? '')
                setEditInstructionsOpen(true)
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={
                project.instructions ? 'Edit instructions' : 'Add instructions'
              }
            >
              {project.instructions ? (
                <Pencil className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
            </button>
          </div>
          {project.instructions ? (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {project.instructions}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add instructions to tailor responses for this project.
            </p>
          )}
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="rename-input" className="sr-only">
              Name
            </Label>
            <Input
              id="rename-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveName()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditNameOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveName}
              disabled={!editName.trim() || isPending}
            >
              {isPending ? <Spinner className="size-4" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Instructions dialog */}
      <Dialog
        open={editInstructionsOpen}
        onOpenChange={setEditInstructionsOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instructions</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Add instructions to tailor responses for this project..."
              value={editInstructions}
              onChange={e => setEditInstructions(e.target.value)}
              rows={6}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditInstructionsOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveInstructions} disabled={isPending}>
              {isPending ? <Spinner className="size-4" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete project dialog */}
      <AlertDialog open={deleteProjectOpen} onOpenChange={setDeleteProjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{project.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The project will be deleted. Chats inside it will be kept but
              removed from the project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={e => {
                e.preventDefault()
                handleDeleteProject()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? <Spinner /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove chat from project dialog */}
      <AlertDialog
        open={!!removeChatTarget}
        onOpenChange={open => !open && setRemoveChatTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from project?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{removeChatTarget?.title}&quot; will be removed from this
              project but the chat itself will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={e => {
                e.preventDefault()
                if (removeChatTarget) handleRemoveChat(removeChatTarget)
              }}
            >
              {isPending ? <Spinner /> : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
