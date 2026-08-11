import { toPublicErrorPayload } from '@/lib/errors/public-error'

import { describeStreamError } from './describe-stream-error'
import { buildAPICallErrorDiagnostics } from './log-api-call-error'

const MAX_IDENTIFIER_LENGTH = 128

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

// Matched on the error name only: the tool layer aborts its own controller on a
// timeout, and that failure must stay on the error surface.
function isNamedAbortError(error: unknown): boolean {
  if (!isObject(error)) return false

  const isError =
    error instanceof Error ||
    (typeof DOMException !== 'undefined' && error instanceof DOMException)

  return (
    isError && (error.name === 'AbortError' || error.name === 'ResponseAborted')
  )
}

export function isStreamAbortError(error: unknown): boolean {
  if (isNamedAbortError(error)) return true
  if (!isObject(error)) return false

  return isNamedAbortError(Reflect.get(error, 'cause'))
}

function capIdentifier(value: unknown): string | number | undefined {
  if (typeof value === 'string') return value.slice(0, MAX_IDENTIFIER_LENGTH)

  return typeof value === 'number' ? value : undefined
}

function getName(value: unknown): string | undefined {
  if (!isObject(value)) return typeof value

  const name = Reflect.get(value, 'name')
  if (typeof name === 'string' && name) {
    return name.slice(0, MAX_IDENTIFIER_LENGTH)
  }

  const constructorName = value.constructor?.name
  return typeof constructorName === 'string' && constructorName
    ? constructorName.slice(0, MAX_IDENTIFIER_LENGTH)
    : undefined
}

function getShape(value: unknown) {
  const name = getName(value)
  const code = isObject(value)
    ? capIdentifier(Reflect.get(value, 'code'))
    : undefined
  const errno = isObject(value)
    ? capIdentifier(Reflect.get(value, 'errno'))
    : undefined

  return {
    ...(name && { name }),
    ...(code !== undefined && { code }),
    ...(errno !== undefined && { errno })
  }
}

/**
 * Identifiers and shapes only, following the discipline of
 * `buildAPICallErrorDiagnostics`: no message, no stack, nothing derived from
 * user input. Only an unclassified failure needs this, since every other code
 * is already its own signature in the status message.
 */
export function buildStreamErrorShape(
  error: unknown
): Record<string, unknown> | null {
  try {
    if (toPublicErrorPayload(error).code !== 'unknown') return null

    const cause = isObject(error) ? Reflect.get(error, 'cause') : undefined
    const causeShape = isObject(cause) ? getShape(cause) : undefined

    return {
      ...getShape(error),
      ...(causeShape &&
        Object.keys(causeShape).length > 0 && { cause: causeShape })
    }
  } catch {
    return null
  }
}

export function buildStreamErrorSpanUpdate(
  error: unknown,
  requestWasCancelled: boolean
) {
  // A cancelled turn is the user walking away, not a failure. The name alone
  // does not prove that: an internal timeout aborts its own signal and raises
  // the same one, so the request must have been cancelled too before the
  // failure is dropped from the error surface.
  if (requestWasCancelled && isStreamAbortError(error)) return null

  const apiCallDiagnostics = buildAPICallErrorDiagnostics(error)
  const streamErrorShape = buildStreamErrorShape(error)

  return {
    level: 'ERROR' as const,
    statusMessage: describeStreamError(error),
    ...((apiCallDiagnostics || streamErrorShape) && {
      metadata: {
        ...(apiCallDiagnostics && { apiCallDiagnostics }),
        ...(streamErrorShape && { streamErrorShape })
      }
    })
  }
}
