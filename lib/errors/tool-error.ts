import type { PublicErrorPayload } from './public-error'

export type ToolName = 'fetch' | 'search'

/**
 * Raised by the fetch tool when its argument is not an address at all, so the
 * classifier can tell that case apart from a page that really did fail. The
 * platform's own text embeds the rejected value, which would otherwise put a
 * model-authored string into the trace and into the copy shown to the user.
 */
export const INVALID_URL_SENTINEL = 'Invalid fetch URL.'

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

const REFUSED = (subject: string) => `${subject} refused the request.`
const NOT_FOUND = (subject: string) => `${subject} could not be found.`
const RATE_LIMITED = (subject: string) =>
  `${subject} is rate limiting requests. Please try again shortly.`
const UNAVAILABLE = (subject: string) =>
  `${subject} is temporarily unavailable. Please try again shortly.`
const TOO_SLOW = (subject: string) => `${subject} took too long to respond.`
const INVALID_URL = 'The link is not a valid web address.'
const UNREADABLE_TYPE = 'The page is not in a readable text format.'
const NO_CONTENT = 'The page did not return any readable content.'
const FETCH_FALLBACK = 'The page could not be read.'
const SEARCH_FALLBACK = 'The search could not be completed.'

/**
 * Every sentence this module can produce.
 *
 * `public-error` preserves a `tool_failed` message instead of reclassifying it,
 * and an error whose own text happens to be JSON is parsed by that same code
 * path. Checking membership here means an upstream payload claiming the code
 * can still only carry copy we wrote ourselves.
 */
export const TOOL_FAILURE_MESSAGES: ReadonlySet<string> = new Set([
  ...Object.values(SUBJECT).flatMap(subject => [
    REFUSED(subject),
    NOT_FOUND(subject),
    RATE_LIMITED(subject),
    UNAVAILABLE(subject),
    TOO_SLOW(subject)
  ]),
  INVALID_URL,
  UNREADABLE_TYPE,
  NO_CONTENT,
  FETCH_FALLBACK,
  SEARCH_FALLBACK
])

export function isToolFailureMessage(message: string): boolean {
  return TOOL_FAILURE_MESSAGES.has(message)
}

function classifyToolFailure(error: ToolFailureError): {
  message: string
  retryable: boolean
} {
  const message = error.originalMessage
  const status = error.status
  const subject = SUBJECT[error.toolName]

  if (error.toolName === 'fetch' && message === INVALID_URL_SENTINEL) {
    return { message: INVALID_URL, retryable: false }
  }

  if (status === 403 || /\b403\b|\bforbidden\b/i.test(message)) {
    return { message: REFUSED(subject), retryable: false }
  }

  if (status === 404 || /\b404\b|\bnot found\b/i.test(message)) {
    return { message: NOT_FOUND(subject), retryable: false }
  }

  if (
    status === 429 ||
    /\b429\b|too many requests|rate[_\s-]?limit/i.test(message)
  ) {
    return { message: RATE_LIMITED(subject), retryable: true }
  }

  if (
    (status !== undefined && status >= 500 && status <= 599) ||
    /\b5\d{2}\b|service unavailable|bad gateway/i.test(message)
  ) {
    return { message: UNAVAILABLE(subject), retryable: true }
  }

  if (/timeout|timed out|abort/i.test(message)) {
    return { message: TOO_SLOW(subject), retryable: true }
  }

  if (/unsupported content type/i.test(message)) {
    return { message: UNREADABLE_TYPE, retryable: false }
  }

  if (
    /no results returned from content extraction service/i.test(message) ||
    /no data returned from jina reader api/i.test(message)
  ) {
    return { message: NO_CONTENT, retryable: true }
  }

  return {
    message: error.toolName === 'fetch' ? FETCH_FALLBACK : SEARCH_FALLBACK,
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
