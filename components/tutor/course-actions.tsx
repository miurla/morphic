'use client'

import { useRef, useState } from 'react'

import { IconDots, IconLoader2, IconTrash } from '@tabler/icons-react'
import { toast } from 'sonner'

import type { TutorCourseSummary } from '@/lib/tutor/types'

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

import { useI18n } from '@/components/language-provider'

import { errorMessage, tutorRequest, TutorRequestError } from './api'

export function CourseActions({
  course,
  onDeleted
}: {
  course: Pick<TutorCourseSummary, 'id' | 'title'>
  onDeleted: (courseId: string) => void
}) {
  const { t, locale } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)

  async function remove() {
    if (pending.current) return
    pending.current = true
    setDeleting(true)
    setError('')
    try {
      try {
        await tutorRequest(
          `/api/tutor/courses/${encodeURIComponent(course.id)}`,
          locale,
          { method: 'DELETE' }
        )
      } catch (cause) {
        // Another tab or a retry after a lost response may have removed it already.
        if (!(cause instanceof TutorRequestError && cause.status === 404))
          throw cause
      }
      setDialogOpen(false)
      toast.success(t('Learning path deleted'))
      onDeleted(course.id)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      pending.current = false
      setDeleting(false)
    }
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={trigger}
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={t('Actions for {title}', { title: course.title })}
          >
            <IconDots className="size-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="[--tutor-danger:color-mix(in_srgb,var(--destructive)_80%,var(--foreground))]"
        >
          <DropdownMenuItem
            className="gap-2 text-[color:var(--tutor-danger)] focus:text-[color:var(--tutor-danger)]"
            onSelect={() => {
              setMenuOpen(false)
              setError('')
              setDialogOpen(true)
            }}
          >
            <IconTrash className="size-4" aria-hidden />
            {t('Delete learning path')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={dialogOpen}
        onOpenChange={open => {
          if (!pending.current) setDialogOpen(open)
        }}
      >
        <AlertDialogContent
          className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg [--tutor-danger:color-mix(in_srgb,var(--destructive)_80%,var(--foreground))]"
          onCloseAutoFocus={event => {
            event.preventDefault()
            trigger.current?.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">
              {t('Delete “{title}”?', { title: course.title })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'This permanently deletes the chapters, exercises, answers, and learning progress for this path. This cannot be undone. Your uploaded original materials will be kept.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p
              role="alert"
              className="text-sm text-[color:var(--tutor-danger)]"
            >
              {t(error)}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="gap-2 bg-[color:var(--tutor-danger)] text-destructive-foreground hover:bg-[color:color-mix(in_srgb,var(--destructive)_75%,var(--foreground))]"
              onClick={event => {
                event.preventDefault()
                void remove()
              }}
            >
              {deleting && (
                <IconLoader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              )}
              {t(deleting ? 'Deleting…' : 'Delete learning path')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
