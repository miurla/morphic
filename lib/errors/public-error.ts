export type PublicErrorType = 'rate-limit' | 'auth' | 'forbidden' | 'general'

export type PublicErrorCode =
  | 'auth_required'
  | 'bad_request'
  | 'context_length'
  | 'forbidden'
  | 'model_unavailable'
  | 'provider_auth'
  | 'provider_billing'
  | 'provider_quota'
  | 'provider_rate_limit'
  | 'provider_unavailable'
  | 'rate_limit'
  | 'unknown'

export type PublicErrorPayload = {
  error: string
  code: PublicErrorCode
  type: PublicErrorType
  details?: string
  retryable?: boolean
  authRequired?: boolean
  resetAt?: number
  remaining?: number
  limit?: number
  mode?: string
}

type PublicErrorOptions = {
  status?: number
  fallbackMessage?: string
}

type ErrorSnapshot = {
  message: string
  statusCode?: number
  code?: string | number
  name?: string
}

const DEFAULT_PUBLIC_ERROR_MESSAGE =
  'We could not generate a response. Please try again.'
const PROVIDER_QUOTA_PUBLIC_MESSAGE =
  'The selected AI model has exhausted its quota. Choose another model or try again later.'

const PUBLIC_ERROR_CODES: ReadonlySet<string> = new Set([
  'auth_required',
  'bad_request',
  'context_length',
  'forbidden',
  'model_unavailable',
  'provider_auth',
  'provider_billing',
  'provider_quota',
  'provider_rate_limit',
  'provider_unavailable',
  'rate_limit',
  'unknown'
])

const PUBLIC_ERROR_TYPES: ReadonlySet<string> = new Set([
  'rate-limit',
  'auth',
  'forbidden',
  'general'
])

const BILLING_PATTERNS = [
  /\bbilling\b/i,
  /\bcredits?\b/i,
  /\bpayment\b/i,
  /\bsubscription\b/i,
  /\bbalance\b/i,
  /insufficient[_\s-]?quota/i,
  /insufficient[_\s-]?credit/i,
  /exceeded your current quota/i,
  /exhausted (its|your) quota/i,
  /provider[_\s-]?quota/i,
  /quota exceeded/i
]

const PROVIDER_AUTH_PATTERNS = [
  /\bapi[_\s-]?key\b/i,
  /\baccess token\b/i,
  /\bbearer token\b/i,
  /\bcredential/i,
  /\binvalid key\b/i,
  /\bmissing key\b/i,
  /\bincorrect api key\b/i
]

const AUTH_REQUIRED_PATTERNS = [
  /authentication required/i,
  /not authenticated/i,
  /please sign in/i,
  /sign in to/i,
  /\blog ?in to (your )?account\b/i,
  /\blog ?in to continue\b/i
]

const RATE_LIMIT_PATTERNS = [
  /\brate[_\s-]?limit/i,
  /too many requests/i,
  /daily limit/i,
  /\b429\b/
]

const CONTEXT_LENGTH_PATTERNS = [
  /context length/i,
  /context window/i,
  /maximum context/i,
  /token limit/i,
  /too many tokens/i
]

const MODEL_UNAVAILABLE_PATTERNS = [
  /model .*not found/i,
  /no such model/i,
  /model .*unavailable/i,
  /unsupported model/i
]

const SYSTEM_PATTERNS = [
  /internal server error/i,
  /service unavailable/i,
  /bad gateway/i,
  /gateway timeout/i,
  /database/i,
  /redis/i,
  /postgres/i,
  /supabase/i,
  /stack/i,
  /trace/i,
  /exception/i
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asPublicErrorCode(value: unknown): PublicErrorCode | undefined {
  return typeof value === 'string' && PUBLIC_ERROR_CODES.has(value)
    ? (value as PublicErrorCode)
    : undefined
}

function asPublicErrorType(value: unknown): PublicErrorType | undefined {
  return typeof value === 'string' && PUBLIC_ERROR_TYPES.has(value)
    ? (value as PublicErrorType)
    : undefined
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(value))
}

function extractJsonCandidate(value: string): unknown | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    // AI SDK sometimes wraps a JSON response body in Error(message). Keep a
    // conservative fallback for messages that include that body with prefixes.
  }

  const match = trimmed.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

function extractNestedMessage(
  value: Record<string, unknown>
): string | undefined {
  const topLevelError = getString(value.error)
  if (topLevelError) return topLevelError

  const topLevelMessage = getString(value.message)
  if (topLevelMessage) return topLevelMessage

  if (isRecord(value.error)) {
    return getString(value.error.message)
  }
}

function safeStringifyRecord(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value, Object.keys(value).sort())
  } catch {
    return String(value)
  }
}

function snapshotError(error: unknown): ErrorSnapshot {
  if (typeof error === 'string') {
    return { message: error }
  }

  if (error instanceof Error) {
    const record = error as Error & Record<string, unknown>
    return {
      message: error.message,
      statusCode:
        getNumber(record.statusCode) ??
        getNumber(record.status) ??
        getNumber(record.cause),
      code:
        (typeof record.code === 'string' || typeof record.code === 'number'
          ? record.code
          : undefined) ??
        (isRecord(record.data) &&
        (typeof record.data.code === 'string' ||
          typeof record.data.code === 'number')
          ? record.data.code
          : undefined),
      name: error.name
    }
  }

  if (isRecord(error)) {
    return {
      message: extractNestedMessage(error) ?? safeStringifyRecord(error),
      statusCode: getNumber(error.statusCode) ?? getNumber(error.status),
      code:
        typeof error.code === 'string' || typeof error.code === 'number'
          ? error.code
          : undefined,
      name: getString(error.name)
    }
  }

  return { message: String(error) }
}

function typeForCode(code: PublicErrorCode): PublicErrorType {
  switch (code) {
    case 'auth_required':
      return 'auth'
    case 'forbidden':
      return 'forbidden'
    case 'provider_rate_limit':
    case 'rate_limit':
      return 'rate-limit'
    default:
      return 'general'
  }
}

function classifyError(snapshot: ErrorSnapshot, fallbackMessage?: string) {
  const message = snapshot.message
  const status = snapshot.statusCode
  const combined = [message, snapshot.code, snapshot.name]
    .filter(value => value !== undefined)
    .join(' ')

  if (status === 403 || /\bforbidden\b/i.test(combined)) {
    return {
      code: 'forbidden' as const,
      type: 'forbidden' as const,
      error: 'You do not have permission to access this resource.',
      retryable: false
    }
  }

  if (matchesAny(combined, PROVIDER_AUTH_PATTERNS)) {
    return {
      code: 'provider_auth' as const,
      type: 'general' as const,
      error:
        'The AI service is not configured correctly. Please try again later.',
      retryable: false
    }
  }

  if (status === 401 || matchesAny(combined, AUTH_REQUIRED_PATTERNS)) {
    return {
      code: 'auth_required' as const,
      type: 'auth' as const,
      error: 'Please sign in to continue.',
      retryable: false,
      authRequired: true
    }
  }

  if (matchesAny(combined, BILLING_PATTERNS)) {
    const isQuotaError = /quota/i.test(combined)
    return {
      code: isQuotaError
        ? ('provider_quota' as const)
        : ('provider_billing' as const),
      type: 'general' as const,
      error: isQuotaError
        ? PROVIDER_QUOTA_PUBLIC_MESSAGE
        : 'The AI service is currently unavailable.',
      retryable: false
    }
  }

  if (status === 429 || matchesAny(combined, RATE_LIMIT_PATTERNS)) {
    const isDailyLimit = /daily limit/i.test(combined)
    return {
      code: isDailyLimit
        ? ('rate_limit' as const)
        : ('provider_rate_limit' as const),
      type: 'rate-limit' as const,
      error: isDailyLimit
        ? 'You have reached your daily chat limit. Please try again tomorrow.'
        : 'The AI service is receiving too many requests. Please try again shortly.',
      details: isDailyLimit
        ? 'The limit resets at midnight UTC.'
        : 'Please wait a moment before trying again.',
      retryable: !isDailyLimit
    }
  }

  if (matchesAny(combined, CONTEXT_LENGTH_PATTERNS)) {
    return {
      code: 'context_length' as const,
      type: 'general' as const,
      error:
        'This conversation is too long for the selected model. Start a new chat or shorten your message.',
      retryable: false
    }
  }

  if (matchesAny(combined, MODEL_UNAVAILABLE_PATTERNS)) {
    return {
      code: 'model_unavailable' as const,
      type: 'general' as const,
      error: 'The selected model is unavailable. Please choose another model.',
      retryable: false
    }
  }

  if (status === 400) {
    return {
      code: 'bad_request' as const,
      type: 'general' as const,
      error: fallbackMessage ?? 'The request could not be processed.',
      retryable: false
    }
  }

  if (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    matchesAny(combined, SYSTEM_PATTERNS)
  ) {
    return {
      code: 'provider_unavailable' as const,
      type: 'general' as const,
      error: fallbackMessage ?? DEFAULT_PUBLIC_ERROR_MESSAGE,
      retryable: true
    }
  }

  return {
    code: 'unknown' as const,
    type: 'general' as const,
    error: fallbackMessage ?? DEFAULT_PUBLIC_ERROR_MESSAGE,
    retryable: true
  }
}

function isIntentionalPublicPayload(
  value: Record<string, unknown>,
  code: PublicErrorCode
): boolean {
  return (
    Boolean(value.authRequired) ||
    getNumber(value.resetAt) !== undefined ||
    getNumber(value.remaining) !== undefined ||
    (code === 'rate_limit' && getString(value.mode) !== undefined)
  )
}

function fromParsedPayload(
  value: Record<string, unknown>,
  options: PublicErrorOptions
): PublicErrorPayload | null {
  const message = extractNestedMessage(value)
  if (!message) return null

  const status = getNumber(value.status) ?? options.status
  const classification = classifyError(
    {
      message,
      statusCode: status,
      code: getString(value.code) ?? getString(value.errorCode),
      name: getString(value.name)
    },
    options.fallbackMessage
  )
  const code = asPublicErrorCode(value.code) ?? classification.code
  const type = asPublicErrorType(value.type) ?? typeForCode(code)
  const preserveMessage = isIntentionalPublicPayload(value, code)

  return {
    error: preserveMessage ? message : classification.error,
    code,
    type,
    details: getString(value.details) ?? classification.details,
    retryable:
      typeof value.retryable === 'boolean'
        ? value.retryable
        : classification.retryable,
    authRequired:
      typeof value.authRequired === 'boolean'
        ? value.authRequired
        : classification.authRequired,
    resetAt: getNumber(value.resetAt),
    remaining: getNumber(value.remaining),
    limit: getNumber(value.limit),
    mode: getString(value.mode)
  }
}

export function toPublicErrorPayload(
  error: unknown,
  options: PublicErrorOptions = {}
): PublicErrorPayload {
  if (typeof error === 'string') {
    const parsed = extractJsonCandidate(error)
    if (isRecord(parsed)) {
      const payload = fromParsedPayload(parsed, options)
      if (payload) return payload
    }
  } else if (error instanceof Error) {
    const parsed = extractJsonCandidate(error.message)
    if (isRecord(parsed)) {
      const payload = fromParsedPayload(parsed, options)
      if (payload) return payload
    }
  } else if (isRecord(error)) {
    const payload = fromParsedPayload(error, options)
    if (payload) return payload
  }

  const snapshot = snapshotError(error)
  const classification = classifyError(
    { ...snapshot, statusCode: snapshot.statusCode ?? options.status },
    options.fallbackMessage
  )

  return {
    error: classification.error,
    code: classification.code,
    type: classification.type,
    details: classification.details,
    retryable: classification.retryable,
    authRequired: classification.authRequired
  }
}

export function serializePublicError(
  error: unknown,
  options: PublicErrorOptions = {}
): string {
  return JSON.stringify(toPublicErrorPayload(error, options))
}

export function createPublicErrorResponse(
  error: unknown,
  init: ResponseInit & PublicErrorOptions = {}
): Response {
  const { fallbackMessage, status = 500, ...responseInit } = init
  return new Response(
    serializePublicError(error, { fallbackMessage, status }),
    {
      ...responseInit,
      status,
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(new Headers(responseInit.headers).entries())
      }
    }
  )
}

export function getPublicRateLimitDetails(error: PublicErrorPayload): string {
  if (error.mode === 'adaptive') {
    return 'The limit resets at midnight UTC. You can continue using Quick mode without restrictions.'
  }

  if (error.details) return error.details

  if (error.code === 'provider_rate_limit') {
    return 'Please wait a moment before trying again.'
  }

  return 'The limit resets at midnight UTC.'
}
