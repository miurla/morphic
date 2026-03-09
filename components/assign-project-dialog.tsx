'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'

import { Check, FolderOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { updateChatProject } from '@/lib/actions/project'
import { Project } from '@/lib/db/schema'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

interface AssignProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatId: string
  currentProjectId: string | null
  onAssigned?: (projectId: string | null) => void
}

export function AssignProjectDialog({
  open,
  onOpenChange,
  chatId,
  currentProjectId,
  onAssigned
}: AssignProjectDialogProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: { projects: Project[] }) => setProjects(data.projects))
      .catch(() => toast.error('Failed to load projects.'))
      .finally(() => setIsLoading(false))
  }, [open])

  const handleSelect = useCallback(
    (projectId: string | null) => {
      if (projectId === currentProjectId) {
        onOpenChange(false)
        return
      }
      startTransition(async () => {
        const result = await updateChatProject(chatId, projectId)
        if (result.success) {
          toast.success(
            projectId ? 'Chat added to project.' : 'Chat removed from project.'
          )
          onAssigned?.(projectId)
          onOpenChange(false)
        } else {
          toast.error(result.error ?? 'Failed to update project.')
        }
      })
    },
    [chatId, currentProjectId, onAssigned, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to project</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 py-1">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No projects yet.{' '}
              <a href="/projects" className="underline">
                Create one
              </a>
              .
            </p>
          ) : (
            <>
              {/* No project option */}
              <button
                onClick={() => handleSelect(null)}
                disabled={isPending}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left disabled:opacity-50"
              >
                <span className="text-muted-foreground">No project</span>
                {currentProjectId === null && (
                  <Check className="size-4 shrink-0" />
                )}
              </button>

              <div className="h-px bg-border mx-1 my-0.5" />

              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project.id)}
                  disabled={isPending}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left disabled:opacity-50"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{project.name}</span>
                  </span>
                  {currentProjectId === project.id ? (
                    <Check className="size-4 shrink-0" />
                  ) : isPending ? (
                    <Spinner className="size-4 shrink-0" />
                  ) : null}
                </button>
              ))}
            </>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
          className="w-full"
        >
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  )
}
