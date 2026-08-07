import type { PublicErrorPayload } from './public-error'

export type ToolName = 'fetch' | 'search'

// What the failure happened to. The whole point of this module is that it is
// never the user and never the AI service.
const SUBJECT: Record<ToolName, string> = {
  fetch: 'The page',
  search: 'The search service'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined

  const record = error as Record<string, unknown>
  const status = record.statusCode ?? record.status
  return typeof status === 'number' && Number.isFinite(status)
    ? status
    : undefined
}

export class ToolFailureError extends Error {
  readonly isToolFailureError = true
  readonly originalMessage: string
  readonly status?: number

  constructor(
    readonly toolName: ToolName,
    error: unknown
  ) {
    const originalMessage = getErrorMessage(error)
    super(originalMessage, { cause: error })
    this.name = 'ToolFailureError'
    this.originalMessage = originalMessage
    this.status = getErrorStatus(error)
  }
}

/**
 * Structural rather than `instanceof`, so a failure that crossed a bundle
 * boundary is still recognized as one.
 */
export function isToolFailureError(error: unknown): error is ToolFailureError {
  if (typeof error !== 'object' || error === null) return false

  const value = error as Record<string, unknown>
  return (
    value.isToolFailureError === true &&
    (value.toolName === 'fetch' || value.toolName === 'search') &&
    typeof value.originalMessage === 'string'
  )
}

function classifyToolFailure(error: ToolFailureError): {
  message: string
  retryable: boolean
} {
  const message = error.originalMessage
  const status = error.status
  const subject = SUBJECT[error.toolName]

  if (status === 403 || /\b403\b|\bforbidden\b/i.test(message)) {
    return { message: `${subject} refused the request.`, retryable: false }
  }

  if (status === 404 || /\b404\b|\bnot found\b/i.test(message)) {
    return { message: `${subject} could not be found.`, retryable: false }
  }

  if (
    status === 429 ||
    /\b429\b|too many requests|rate[_\s-]?limit/i.test(message)
  ) {
    return {
      message: `${subject} is rate limiting requests. Please try again shortly.`,
      retryable: true
    }
  }

  if (
    (status !== undefined && status >= 500 && status <= 599) ||
    /\b5\d{2}\b|service unavailable|bad gateway/i.test(message)
  ) {
    return {
      message: `${subject} is temporarily unavailable. Please try again shortly.`,
      retryable: true
    }
  }

  if (/timeout|timed out|abort/i.test(message)) {
    return { message: `${subject} took too long to respond.`, retryable: true }
  }

  if (/unsupported content type/i.test(message)) {
    return {
      message: 'The page is not in a readable text format.',
      retryable: false
    }
  }

  if (
    /no results returned from content extraction service/i.test(message) ||
    /no data returned from jina reader api/i.test(message)
  ) {
    return {
      message: 'The page did not return any readable content.',
      retryable: true
    }
  }

  return {
    message:
      error.toolName === 'fetch'
        ? 'The page could not be read.'
        : 'The search could not be completed.',
    retryable: true
  }
}

export function getToolFailureMessage(error: ToolFailureError): string {
  return classifyToolFailure(error).message
}

export function serializeToolFailure(error: ToolFailureError): string {
  const { message, retryable } = classifyToolFailure(error)
  const payload: PublicErrorPayload = {
    error: message,
    code: 'tool_failed',
    type: 'general',
    retryable
  }

  return JSON.stringify(payload)
}
