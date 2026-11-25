import type { Locale } from '@/lib/i18n/config'

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
