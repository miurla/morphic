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
import { DEFAULT_TUTOR_LIMITS } from '@/lib/tutor/limits'
import type {
  TutorCapabilities,
  TutorCourse,
  TutorLevel
} from '@/lib/tutor/types'

import { Button } from '@/components/ui/button'
import { IconBlinkingLogo } from '@/components/ui/icons'
import { Textarea } from '@/components/ui/textarea'

import { useI18n } from '@/components/language-provider'

import { errorMessage, tutorRequest } from './api'
import { useDocumentUploads } from './use-document-uploads'

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
  const [goal, setGoal] = useState('')
  const [level, setLevel] = useState<TutorLevel>('beginner')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const limits = { ...DEFAULT_TUTOR_LIMITS, ...capabilities }
  const maxFiles = limits.maxFiles
  const maxSize = limits.maxFileSize
  const uploads = useDocumentUploads(
    locale,
    limits.uploadConcurrency,
    message => toast.error(t(message))
  )
  const { files, filesRef } = uploads
  const totalBytes = files.reduce((total, item) => total + item.file.size, 0)
  const documents = [
    ...new Map(
      files.flatMap(item =>
        item.document ? [[item.document.id, item.document] as const] : []
      )
    ).values()
  ]
  const pages = documents.reduce(
    (total, document) => total + (document.pageCount ?? 0),
    0
  )
  const tokens = documents.reduce(
    (total, document) => total + (document.tokenCount ?? 0),
    0
  )
  const chunks = documents.reduce(
    (total, document) => total + (document.chunkCount ?? 0),
    0
  )
  const budgetError =
    files.length > maxFiles
      ? t('Choose up to {count} files.', { count: maxFiles })
      : totalBytes > limits.maxCourseSize
        ? t(
            'Course files exceed {size} MB. Remove files or split them into separate courses.',
            { size: limits.maxCourseSize / 1024 / 1024 }
          )
        : pages > limits.maxPages ||
            tokens > limits.maxCourseTokens ||
            chunks > limits.maxCourseChunks
          ? t(
              'These materials exceed the course processing budget. Remove files or split them into separate courses.'
            )
          : ''

  function addFiles(incoming: File[]) {
    if (busy || !incoming.length) return
    const accepted: File[] = []
    const rejected: string[] = []
    let bytes = filesRef.current.reduce(
      (total, item) => total + item.file.size,
      0
    )
    for (const file of incoming) {
      let reason = ''
      if (!getTutorDocumentFormat(file.name))
        reason = t('Please upload PDF, TXT, Markdown, or DOCX files.')
      else if (!file.size || file.size > maxSize)
        reason = t(
          'Each file must be non-empty and no larger than {size} MB.',
          { size: maxSize / 1024 / 1024 }
        )
      else if (filesRef.current.length + accepted.length >= maxFiles)
        reason = t('Choose up to {count} files.', { count: maxFiles })
      else if (bytes + file.size > limits.maxCourseSize)
        reason = t(
          'Course files exceed {size} MB. Remove files or split them into separate courses.',
          { size: limits.maxCourseSize / 1024 / 1024 }
        )
      if (reason) rejected.push(`${file.name}: ${reason}`)
      else {
        accepted.push(file)
        bytes += file.size
      }
    }
    setError(rejected.join('\n'))
    uploads.add(accepted)
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
    if (
      files.some(file => file.phase === 'queued' || file.phase === 'uploading')
    ) {
      toast.error(t('Wait for your files to finish uploading.'))
      return
    }
    if (
      files.some(file => file.phase === 'failed' || file.phase === 'cancelled')
    ) {
      toast.error(
        t('Retry or remove failed uploads before creating a learning route.')
      )
      return
    }
    if (files.some(file => file.phase !== 'ready')) {
      toast.error(t('Wait for your files to finish processing.'))
      return
    }
    if (budgetError) {
      toast.error(budgetError)
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
            documentIds: [...new Set(files.map(file => file.document!.id))],
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
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {t(
                'Course limit: {size} MB total · {pages} pages or text segments · {tokens} tokens',
                {
                  size: limits.maxCourseSize / 1024 / 1024,
                  pages: limits.maxPages,
                  tokens: limits.maxCourseTokens.toLocaleString(locale)
                }
              )}
            </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {t('Each PDF can contain up to {pages} pages.', {
                pages: limits.maxPdfPages
              })}
            </p>
            {files.length > 0 && (
              <p
                className="mt-3 text-xs text-muted-foreground"
                aria-live="polite"
              >
                {t(
                  '{count} files · {size} MB · {pages} pages or text segments processed · {tokens} tokens',
                  {
                    count: files.length,
                    size: (totalBytes / 1024 / 1024).toFixed(1),
                    pages,
                    tokens: tokens.toLocaleString(locale)
                  }
                )}
              </p>
            )}
            {files.length > 0 && (
              <ul
                className="mt-3 max-h-80 space-y-2 overflow-y-auto"
                aria-label={t('Selected files')}
              >
                {files.map(item => (
                  <li
                    key={item.id}
                    className="rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {['uploading', 'uploaded', 'parsing'].includes(
                        item.phase
                      ) ? (
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
                        {t(
                          {
                            queued: 'Waiting to upload',
                            uploading: 'Uploading…',
                            uploaded: 'Uploaded · waiting to process',
                            parsing: 'Processing…',
                            ready: 'Ready to use',
                            failed: 'Needs attention',
                            cancelled: 'Upload cancelled'
                          }[item.phase]
                        )}
                        {item.phase === 'uploading' && ` ${item.progress}%`}
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
                        onClick={() => uploads.remove(item.id)}
                      >
                        <IconX className="size-4" />
                      </Button>
                    </div>
                    {item.phase === 'uploading' && (
                      <progress
                        className="mt-2 h-1.5 w-full accent-foreground"
                        value={item.progress}
                        max={100}
                        aria-label={t('Upload progress for {name}', {
                          name: item.file.name
                        })}
                      />
                    )}
                    {item.document?.pageCount != null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(
                          getTutorDocumentFormat(item.file.name) === 'pdf'
                            ? '{count} pages'
                            : '{count} text segments',
                          { count: item.document.pageCount }
                        )}
                        {item.document.tokenCount != null &&
                          ` · ${t('{count} tokens', { count: item.document.tokenCount.toLocaleString(locale) })}`}
                      </p>
                    )}
                    {item.document?.warnings?.map(warning => {
                      const emptyPages = warning.match(
                        /^Pages with little or no extracted text: (.+)$/
                      )?.[1]
                      return (
                        <p
                          key={warning}
                          className="mt-1 text-xs text-muted-foreground"
                        >
                          {emptyPages
                            ? t(
                                'Pages with little or no extracted text: {pages}',
                                { pages: emptyPages }
                              )
                            : t(warning)}
                        </p>
                      )
                    })}
                    <div className="mt-1 flex items-start justify-between gap-3">
                      {item.error && (
                        <p className="text-xs text-destructive" role="alert">
                          {t(item.error)}
                        </p>
                      )}
                      {['queued', 'uploading'].includes(item.phase) && (
                        <button
                          type="button"
                          disabled={busy}
                          className="ml-auto shrink-0 text-xs underline underline-offset-4"
                          aria-label={t('Cancel upload of {name}', {
                            name: item.file.name
                          })}
                          onClick={() => uploads.cancel(item.id)}
                        >
                          {t('Cancel upload')}
                        </button>
                      )}
                      {['failed', 'cancelled'].includes(item.phase) && (
                        <button
                          type="button"
                          disabled={busy}
                          className="ml-auto shrink-0 text-xs underline underline-offset-4"
                          onClick={() => uploads.retry(item.id)}
                        >
                          {t('Retry')}
                        </button>
                      )}
                    </div>
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
          <p
            role="alert"
            className="whitespace-pre-line text-sm text-destructive"
          >
            {t(error)}
          </p>
        )}
        {budgetError && (
          <p role="alert" className="text-sm text-destructive">
            {budgetError}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            type="submit"
            className="h-11 w-full gap-2 rounded-full px-5 sm:w-auto"
            disabled={busy || Boolean(budgetError)}
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
