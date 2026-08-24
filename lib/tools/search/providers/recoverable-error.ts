const RECOVERABLE_NETWORK_CODES = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET'
])

function getNumericProperty(
  error: unknown,
  property: 'status' | 'statusCode'
): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined

  const value = (error as Record<string, unknown>)[property]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getStringProperty(
  error: unknown,
  property: 'code' | 'message' | 'name'
): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined

  const value = (error as Record<string, unknown>)[property]
  return typeof value === 'string' ? value : undefined
}

function getCause(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return undefined
  return (error as { cause?: unknown }).cause
}

export type RecoverableSearchFailure =
  | { type: 'http'; status: number }
  | { type: 'transport' }

function getErrorChain(error: unknown): unknown[] {
  const chain: unknown[] = []
  const visited = new Set<unknown>()
  let current = error

  while (current !== undefined && !visited.has(current)) {
    visited.add(current)
    chain.push(current)
    current = getCause(current)
  }

  return chain
}

/**
 * General search can safely retry another provider only when the failure is
 * upstream and temporary. Client errors remain terminal because another
 * provider should not be used to reinterpret a malformed request.
 */
export function classifyRecoverableSearchError(
  error: unknown
): RecoverableSearchFailure | null {
  const errorChain = getErrorChain(error)

  // Prefer a numeric HTTP status anywhere in the cause chain. This keeps the
  // fallback decision and its trace metadata based on the same signal.
  for (const current of errorChain) {
    const status =
      getNumericProperty(current, 'status') ??
      getNumericProperty(current, 'statusCode')
    if (status !== undefined) {
      return status === 408 || status === 429 || (status >= 500 && status < 600)
        ? { type: 'http', status }
        : null
    }
  }

  for (const current of errorChain) {
    const code = getStringProperty(current, 'code')
    if (code && RECOVERABLE_NETWORK_CODES.has(code)) {
      return { type: 'transport' }
    }

    const name = getStringProperty(current, 'name')
    if (name === 'TimeoutError') return { type: 'transport' }

    const message = getStringProperty(current, 'message')
    if (
      message &&
      /failed to fetch|fetch failed|network (?:error|request failed)|timed? out/i.test(
        message
      )
    ) {
      return { type: 'transport' }
    }
  }

  return null
}
