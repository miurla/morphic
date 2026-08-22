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

/**
 * General search can safely retry another provider only when the failure is
 * upstream and temporary. Client errors remain terminal because another
 * provider should not be used to reinterpret a malformed request.
 */
export function isRecoverableSearchError(error: unknown): boolean {
  const visited = new Set<unknown>()
  let current = error

  while (current !== undefined && !visited.has(current)) {
    visited.add(current)

    const status =
      getNumericProperty(current, 'status') ??
      getNumericProperty(current, 'statusCode')
    if (status !== undefined) {
      return status === 408 || status === 429 || (status >= 500 && status < 600)
    }

    const code = getStringProperty(current, 'code')
    if (code && RECOVERABLE_NETWORK_CODES.has(code)) return true

    const name = getStringProperty(current, 'name')
    if (name === 'TimeoutError') return true

    const message = getStringProperty(current, 'message')
    if (
      message &&
      /failed to fetch|fetch failed|network (?:error|request failed)|timed? out/i.test(
        message
      )
    ) {
      return true
    }

    current = getCause(current)
  }

  return false
}
