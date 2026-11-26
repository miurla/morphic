import type { Locale } from '@/lib/i18n/config'
import type { TutorDocument } from '@/lib/tutor/types'

export class TutorRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'TutorRequestError'
  }
}

export async function tutorRequest<T>(
  path: string,
  locale: Locale,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('x-morphic-locale', locale)
  if (typeof init.body === 'string')
    headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...init, headers, cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new TutorRequestError(
      payload.error || 'Unable to complete this request. Please try again.',
      response.status,
      payload.code
    )
  return payload as T
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Unable to complete this request. Please try again.'
}

/** XHR exposes actual upload progress and sends the file without multipart copies. */
export function uploadTutorFile(
  file: File,
  locale: Locale,
  signal: AbortSignal,
  onProgress: (percent: number) => void
): Promise<{ document: TutorDocument }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let settled = false
    const finish = (error?: Error, payload?: { document: TutorDocument }) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve(payload!)
    }
    const abort = () => {
      xhr.abort()
      finish(new DOMException('Upload cancelled.', 'AbortError'))
    }
    if (signal.aborted) {
      abort()
      return
    }
    xhr.open('POST', '/api/tutor/documents')
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.setRequestHeader('x-tutor-filename', encodeURIComponent(file.name))
    xhr.setRequestHeader('x-morphic-locale', locale)
    xhr.timeout = 10 * 60 * 1000
    xhr.upload.onprogress = event => {
      if (!settled && event.lengthComputable && event.total > 0)
        onProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100))
        )
    }
    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText)
        if (xhr.status < 200 || xhr.status >= 300)
          finish(
            new TutorRequestError(
              payload.error || 'Upload failed',
              xhr.status,
              payload.code
            )
          )
        else if (!payload.document?.id)
          finish(
            new Error('Unable to complete this request. Please try again.')
          )
        else finish(undefined, payload)
      } catch {
        finish(new Error('Unable to complete this request. Please try again.'))
      }
    }
    xhr.onerror = () =>
      finish(new Error('Upload failed. Check your connection and retry.'))
    xhr.ontimeout = () =>
      finish(new Error('The upload timed out. Please retry.'))
    xhr.onabort = () =>
      finish(new DOMException('Upload cancelled.', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    try {
      xhr.send(file)
    } catch (error) {
      finish(error instanceof Error ? error : new Error('Upload failed'))
    }
  })
}
