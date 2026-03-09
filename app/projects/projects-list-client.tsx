'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Project } from '@/lib/db/schema'

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
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

function getRelativeTime(date: Date | string): string {
  const parsed = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - parsed.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 60) return 'just now'
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return '1 month ago'
  if (diffMonths < 12) return `${diffMonths} months ago`
  const diffYears = Math.floor(diffDays / 365)
  return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`
}

export function ProjectsListClient() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const fetchProjects = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/projects')
      const data = (await res.json()) as { projects: Project[] }
      setProjects(data.projects)
    } catch {
      toast.error('Failed to load projects.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newName.trim(),
            description: newDescription.trim() || undefined
          })
        })
        const data = (await res.json()) as { project: Project }
        setCreateOpen(false)
        setNewName('')
        setNewDescription('')
        router.push(`/projects/${data.project.id}`)
      } catch {
        toast.error('Failed to create project.')
      }
    })
  }, [newName, newDescription, router])

  const handleDelete = useCallback(
    (project: Project) => {
      startTransition(async () => {
        try {
          await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
          toast.success('Project deleted.')
          setDeleteTarget(null)
          fetchProjects()
        } catch {
          toast.error('Failed to delete project.')
        }
      })
    },
    [fetchProjects]
  )

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl">Projects</h1>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            New project
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-9 bg-muted/50 border-transparent focus-visible:border-border"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            {searchQuery
              ? 'No projects match your search.'
              : 'No projects yet. Create one to get started.'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(project => (
              <div
                key={project.id}
                className="group relative rounded-xl border bg-card p-4 hover:border-border/80 transition-colors"
              >
                <Link
                  href={`/projects/${project.id}`}
                  className="block"
                  aria-label={`Open project: ${project.name}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="font-medium text-sm leading-tight">
                      {project.name}
                    </h2>
                    {/* spacer for menu button */}
                    <div className="size-7 shrink-0" />
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {project.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Updated{' '}
                    {getRelativeTime(project.updatedAt ?? project.createdAt)}
                  </p>
                </Link>

                {/* Actions menu — positioned absolute so it doesn't affect Link layout */}
                <div className="absolute top-3 right-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => e.preventDefault()}
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Project actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive"
                        onSelect={e => {
                          e.preventDefault()
                          setDeleteTarget(project)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        Delete project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                placeholder="Project name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) handleCreate()
                }}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-desc">
                Description{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="project-desc"
                placeholder="What is this project about?"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || isPending}
            >
              {isPending ? <Spinner className="size-4" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{deleteTarget?.name}&quot;?
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
                if (deleteTarget) handleDelete(deleteTarget)
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
