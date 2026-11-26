'use client'

import { useEffect, useRef, useState } from 'react'

import type { Locale } from '@/lib/i18n/config'
import type { TutorDocument } from '@/lib/tutor/types'

import {
  errorMessage,
  isAbortError,
  tutorRequest,
  uploadTutorFile
} from './api'

export interface PendingFile {
  id: string
  file: File
  document?: TutorDocument
  error?: string
  phase:
    | 'queued'
    | 'uploading'
    | 'uploaded'
    | 'parsing'
    | 'ready'
    | 'failed'
    | 'cancelled'
  progress: number
}

export function useDocumentUploads(
  locale: Locale,
  concurrency: number,
  onError: (message: string) => void
) {
  const [files, setFiles] = useState<PendingFile[]>([])
  const filesRef = useRef<PendingFile[]>([])
  const mounted = useRef(false)
  const active = useRef(new Set<string>())
  const controllers = useRef(new Map<string, AbortController>())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const settings = useRef({ locale, onError })
  settings.current = { locale, onError }

  function update(updater: (current: PendingFile[]) => PendingFile[]) {
    if (!mounted.current) return
    filesRef.current = updater(filesRef.current)
    setFiles(filesRef.current)
  }

  function patch(id: string, values: Partial<PendingFile>) {
    update(current =>
      current.map(item => (item.id === id ? { ...item, ...values } : item))
    )
  }

  function current(id: string, controller: AbortController) {
    return (
      mounted.current &&
      !controller.signal.aborted &&
      controllers.current.get(id) === controller &&
      filesRef.current.some(item => item.id === id)
    )
  }

  function fail(id: string, error: unknown) {
    const message = errorMessage(error)
    patch(id, { phase: 'failed', error: message })
    settings.current.onError(message)
  }

  function receive(id: string, document: TutorDocument) {
    if (document.status === 'failed') {
      patch(id, {
        document,
        phase: 'failed',
        error: document.error || 'File processing failed. Please retry.'
      })
      return
    }
    const ready = document.status === 'parsed' || document.status === 'ready'
    patch(id, {
      document,
      progress: 100,
      error: undefined,
      phase: ready
        ? 'ready'
        : document.status === 'parsing'
          ? 'parsing'
          : 'uploaded'
    })
    if (!ready) {
      const timer = setTimeout(() => {
        timers.current.delete(id)
        void poll(id, document.id)
      }, 1500)
      timers.current.set(id, timer)
    }
  }

  async function poll(id: string, documentId: string) {
    if (!mounted.current || !filesRef.current.some(item => item.id === id))
      return
    const controller = new AbortController()
    controllers.current.set(id, controller)
    try {
      const result = await tutorRequest<{ document: TutorDocument }>(
        `/api/tutor/documents/${encodeURIComponent(documentId)}`,
        settings.current.locale,
        { signal: controller.signal }
      )
      if (current(id, controller)) receive(id, result.document)
    } catch (error) {
      if (current(id, controller) && !isAbortError(error))
        fail(
          id,
          new Error('Unable to check file processing. Retry to continue.')
        )
    } finally {
      if (controllers.current.get(id) === controller)
        controllers.current.delete(id)
    }
  }

  async function start(item: PendingFile) {
    const controller = new AbortController()
    active.current.add(item.id)
    controllers.current.set(item.id, controller)
    patch(item.id, {
      phase: item.document ? 'parsing' : 'uploading',
      error: undefined,
      progress: item.document ? 100 : 0
    })
    try {
      const result = item.document
        ? await tutorRequest<{ document: TutorDocument }>(
            `/api/tutor/documents/${encodeURIComponent(item.document.id)}`,
            settings.current.locale,
            {
              method: item.document.status === 'failed' ? 'POST' : 'GET',
              signal: controller.signal
            }
          )
        : await uploadTutorFile(
            item.file,
            settings.current.locale,
            controller.signal,
            progress => {
              if (current(item.id, controller)) patch(item.id, { progress })
            }
          )
      if (current(item.id, controller)) receive(item.id, result.document)
    } catch (error) {
      if (current(item.id, controller) && !isAbortError(error))
        fail(item.id, error)
    } finally {
      if (controllers.current.get(item.id) === controller)
        controllers.current.delete(item.id)
      active.current.delete(item.id)
      // Re-run the queue after a slot is released, including a failed request.
      update(currentFiles => [...currentFiles])
    }
  }

  useEffect(() => {
    mounted.current = true
    const currentControllers = controllers.current
    const currentTimers = timers.current
    return () => {
      mounted.current = false
      currentControllers.forEach(controller => controller.abort())
      currentControllers.clear()
      currentTimers.forEach(timer => clearTimeout(timer))
      currentTimers.clear()
    }
  }, [])

  // Reconcile after every state update; the ref reserves slots synchronously.
  useEffect(() => {
    const limit = Math.max(1, Math.min(4, Math.floor(concurrency) || 3))
    for (const item of filesRef.current) {
      if (active.current.size >= limit) break
      if (item.phase === 'queued' && !active.current.has(item.id))
        void start(item)
    }
  })

  function stop(id: string) {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    controllers.current.get(id)?.abort()
    controllers.current.delete(id)
  }

  return {
    files,
    filesRef,
    add: (incoming: File[]) =>
      update(currentFiles => [
        ...currentFiles,
        ...incoming.map(file => ({
          id: crypto.randomUUID(),
          file,
          phase: 'queued' as const,
          progress: 0
        }))
      ]),
    remove: (id: string) => {
      stop(id)
      update(currentFiles => currentFiles.filter(item => item.id !== id))
    },
    cancel: (id: string) => {
      stop(id)
      patch(id, { phase: 'cancelled', error: undefined })
    },
    retry: (id: string) => {
      const item = filesRef.current.find(file => file.id === id)
      if (!item || !['failed', 'cancelled'].includes(item.phase)) return
      patch(id, { phase: 'queued', error: undefined })
    }
  }
}
