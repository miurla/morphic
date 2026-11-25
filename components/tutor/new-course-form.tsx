'use client'

import { useRef, useState } from 'react'

import {
  IconArrowUp,
  IconFileText,
  IconLoader2,
  IconUpload,
  IconX
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { AI_SERVICE_CONFIGURATION_ERROR } from '@/lib/errors/public-error'
import {
  getTutorDocumentFormat,
  TUTOR_DOCUMENT_ACCEPT
} from '@/lib/tutor/document-formats'
import type {
  TutorCapabilities,
  TutorCourse,
  TutorDocument,
  TutorLevel
} from '@/lib/tutor/types'

import { Button } from '@/components/ui/button'
import { IconBlinkingLogo } from '@/components/ui/icons'
import { Textarea } from '@/components/ui/textarea'

import { useI18n } from '@/components/language-provider'

import { errorMessage, tutorRequest } from './api'

interface PendingFile {
  id: string
  file: File
  document?: TutorDocument
  error?: string
  uploading: boolean
}

export function NewCourseForm({
  capabilities,
  onCreated,
  onCreateFailed
}: {
  capabilities: TutorCapabilities | null
  onCreated: (course: TutorCourse) => void
  onCreateFailed?: () => void
}) {
  const { t, locale } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<PendingFile[]>([])
  const [files, setFiles] = useState<PendingFile[]>([])
  const [goal, setGoal] = useState('')
  const [level, setLevel] = useState<TutorLevel>('beginner')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const maxFiles = capabilities?.maxFiles ?? 5
  const maxSize = capabilities?.maxFileSize ?? 5 * 1024 * 1024

  function updateFiles(updater: (current: PendingFile[]) => PendingFile[]) {
    filesRef.current = updater(filesRef.current)
    setFiles(filesRef.current)
  }

  async function upload(item: PendingFile) {
    updateFiles(current =>
      current.map(file =>
        file.id === item.id
          ? { ...file, uploading: true, error: undefined }
          : file
      )
    )
    try {
      const data = new FormData()
      data.set('file', item.file)
      const result = await tutorRequest<{ document: TutorDocument }>(
        '/api/tutor/documents',
        locale,
        { method: 'POST', body: data }
      )
      updateFiles(current =>
        current.map(file =>
          file.id === item.id
            ? { ...file, document: result.document, uploading: false }
            : file
        )
      )
    } catch (cause) {
      const message = errorMessage(cause)
      toast.error(t(message))
      updateFiles(current =>
        current.map(file =>
          file.id === item.id
            ? { ...file, error: message, uploading: false }
            : file
        )
      )
    }
  }

  function addFiles(incoming: File[]) {
    if (busy || !incoming.length) return
    setError('')
    if (filesRef.current.length + incoming.length > maxFiles) {
      setError(t('Choose up to {count} files.', { count: maxFiles }))
      return
    }
    if (incoming.some(file => !getTutorDocumentFormat(file.name))) {
      setError(t('Please upload PDF, TXT, Markdown, or DOCX files.'))
      return
    }
    if (incoming.some(file => file.size > maxSize || file.size === 0)) {
      setError(
        t('Each file must be non-empty and no larger than {size} MB.', {
          size: Math.round(maxSize / 1024 / 1024)
        })
      )
      return
    }
    const additions = incoming.map(file => ({
      id: crypto.randomUUID(),
      file,
      uploading: true
    }))
    updateFiles(current => [...current, ...additions])
    additions.forEach(item => void upload(item))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    // Incomplete input must not hide a known setup error. Complete submissions
    // still reach the server so a stale capability response cannot block them.
    if (
      capabilities?.ready === false &&
      (!files.length || files.some(file => !file.document) || !goal.trim())
    ) {
      toast.error(t(AI_SERVICE_CONFIGURATION_ERROR))
      onCreateFailed?.()
      return
    }
    if (!files.length) {
      toast.error(t('Add a document before creating a learning route.'))
      return
    }
    if (files.some(file => file.uploading)) {
      toast.error(t('Wait for your files to finish uploading.'))
      return
    }
    if (files.some(file => !file.document)) {
      toast.error(
        t('Retry or remove failed uploads before creating a learning route.')
      )
      return
    }
    if (!goal.trim()) {
      toast.error(t('Enter your learning goal.'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await tutorRequest<{ course: TutorCourse }>(
        '/api/tutor/courses',
        locale,
        {
          method: 'POST',
          body: JSON.stringify({
            documentIds: files.map(file => file.document!.id),
            goal: goal.trim(),
            level,
            locale
          })
        }
      )
      onCreated(result.course)
    } catch (cause) {
      toast.error(t(errorMessage(cause)))
      onCreateFailed?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-1 pb-10 pt-8 md:pt-16">
      <div className="mb-7 flex flex-col items-center gap-4 text-center md:mb-10">
        <IconBlinkingLogo className="size-12" aria-hidden />
        <h1 className="text-xl font-medium tracking-tight md:text-2xl">
          {t('Turn saved knowledge into action! Upload your files.')}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {t(
            'A learning path built from your materials, with explanations, examples, and practice.'
          )}
        </p>
      </div>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="overflow-hidden rounded-2xl border bg-background shadow-xs">
          <div
            onDragOver={event => {
              event.preventDefault()
              event.stopPropagation()
              if (!busy) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => {
              event.preventDefault()
              event.stopPropagation()
              setDragging(false)
              addFiles(Array.from(event.dataTransfer.files))
            }}
            className={`border-b p-5 transition-colors ${dragging ? 'bg-accent' : 'bg-muted/20'}`}
          >
            <input
              ref={inputRef}
              id="tutor-files"
              type="file"
              accept={TUTOR_DOCUMENT_ACCEPT}
              multiple
              className="sr-only"
              disabled={busy || files.length >= maxFiles}
              aria-label={t('Upload learning materials')}
              onChange={event => {
                addFiles(Array.from(event.target.files ?? []))
                event.target.value = ''
              }}
            />
            <div className="flex flex-col items-center gap-3 py-3 text-center">
              <IconUpload
                className="size-5 text-muted-foreground"
                aria-hidden
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={busy || files.length >= maxFiles}
                onClick={() => inputRef.current?.click()}
              >
                {t('Choose files')}
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t(
                  'Or drop files here · Up to {count} files · {size} MB each',
                  {
                    count: maxFiles,
                    size: Math.round(maxSize / 1024 / 1024)
                  }
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  'PDF, TXT, Markdown, and DOCX. PDFs must contain selectable text.'
                )}
              </p>
            </div>
            {files.length > 0 && (
              <ul className="mt-3 space-y-2" aria-label={t('Selected files')}>
                {files.map(item => (
                  <li
                    key={item.id}
                    className="rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {item.uploading ? (
                        <IconLoader2
                          className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                          aria-hidden
                        />
                      ) : (
                        <IconFileText
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      )}
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={item.file.name}
                      >
                        {item.file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.uploading
                          ? t('Uploading…')
                          : item.document
                            ? t('Uploaded')
                            : t('Upload failed')}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 shrink-0"
                        disabled={busy}
                        aria-label={t('Remove {name}', {
                          name: item.file.name
                        })}
                        onClick={() =>
                          updateFiles(current =>
                            current.filter(file => file.id !== item.id)
                          )
                        }
                      >
                        <IconX className="size-4" />
                      </Button>
                    </div>
                    {item.error && (
                      <div className="mt-1 flex items-start justify-between gap-3">
                        <p className="text-xs text-destructive" role="alert">
                          {t(item.error)}
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          className="shrink-0 text-xs underline underline-offset-4"
                          onClick={() => void upload(item)}
                        >
                          {t('Retry')}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-5 p-5">
            <div className="space-y-2">
              <label htmlFor="tutor-goal" className="text-sm font-medium">
                {t('What are you learning for?')}
              </label>
              <Textarea
                id="tutor-goal"
                value={goal}
                onChange={event => setGoal(event.target.value)}
                disabled={busy}
                maxLength={2000}
                required
                rows={3}
                placeholder={t(
                  'For example: prepare for a backend interview and explain the key concepts with practical examples.'
                )}
                className="resize-y rounded-xl bg-muted/20 text-base md:text-sm"
              />
            </div>
            <fieldset disabled={busy}>
              <legend className="mb-2 text-sm font-medium">
                {t('Your starting point')}
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {(['beginner', 'intermediate', 'advanced'] as const).map(
                  value => (
                    <label
                      key={value}
                      className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-sm transition-colors ${level === value ? 'border-foreground bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}
                    >
                      <input
                        type="radio"
                        name="tutor-level"
                        value={value}
                        checked={level === value}
                        onChange={() => setLevel(value)}
                        className="peer sr-only"
                      />
                      <span
                        className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                        aria-hidden
                      />
                      {t(
                        value === 'beginner'
                          ? 'New to this'
                          : value === 'intermediate'
                            ? 'Some experience'
                            : 'Experienced'
                      )}
                    </label>
                  )
                )}
              </div>
            </fieldset>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(error)}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            type="submit"
            className="h-11 w-full gap-2 rounded-full px-5 sm:w-auto"
            disabled={busy}
          >
            {busy ? (
              <IconLoader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : (
              <IconArrowUp className="size-4" aria-hidden />
            )}
            {t(busy ? 'Creating your course…' : 'Build my learning path')}
          </Button>
        </div>
      </form>
    </div>
  )
}
