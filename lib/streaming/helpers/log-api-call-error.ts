import { APICallError } from 'ai'

const MAX_DIAGNOSTIC_LENGTH = 4000

// Providers name the turn array differently: chat completions use `messages`,
// the OpenAI Responses API uses `input`, Google uses `contents`.
const TURNS_KEYS = ['messages', 'input', 'contents']

// Enumerated provider error fields only. The response body itself can echo
// request fragments, so it is never logged here.
const ERROR_FIELDS = ['type', 'code', 'param', 'status']

function getSerializedSize(value: unknown): number | null {
  try {
    return JSON.stringify(value)?.length ?? 0
  } catch {
    return null
  }
}

function getPartType(part: unknown): string {
  if (typeof part === 'string') return 'text'
  if (part === null || typeof part !== 'object') return typeof part

  const type = Reflect.get(part, 'type')
  return typeof type === 'string' ? type.slice(0, 64) : 'object'
}

function summarizeContent(content: unknown) {
  const parts = Array.isArray(content) ? content : [content]

  return parts.map(part => ({
    type: getPartType(part),
    length:
      typeof part === 'string'
        ? part.length
        : (getSerializedSize(part) ?? 'unknown')
  }))
}

function summarizeRole(role: unknown): string {
  return role === 'system' ||
    role === 'user' ||
    role === 'assistant' ||
    role === 'tool'
    ? role
    : 'unknown'
}

function summarizeRequestBody(requestBodyValues: unknown) {
  const totalSerializedSize = getSerializedSize(requestBodyValues)

  if (
    requestBodyValues === null ||
    typeof requestBodyValues !== 'object' ||
    Array.isArray(requestBodyValues)
  ) {
    return {
      type: Array.isArray(requestBodyValues)
        ? 'array'
        : requestBodyValues === null
          ? 'null'
          : typeof requestBodyValues,
      totalSerializedSize
    }
  }

  const topLevelKeys = Object.keys(requestBodyValues)
  const turnsKey = TURNS_KEYS.find(key =>
    Array.isArray(Reflect.get(requestBodyValues, key))
  )
  const turns = turnsKey
    ? (Reflect.get(requestBodyValues, turnsKey) as unknown[])
    : undefined

  return {
    topLevelKeys,
    totalSerializedSize,
    ...(turns && {
      turnsKey,
      turnCount: turns.length,
      turns: turns.map(turn => {
        if (turn === null || typeof turn !== 'object') {
          return { role: 'unknown', content: summarizeContent(turn) }
        }

        const content = Reflect.get(turn, 'content')

        return {
          role: summarizeRole(Reflect.get(turn, 'role')),
          content: summarizeContent(
            content === undefined ? Reflect.get(turn, 'parts') : content
          )
        }
      })
    })
  }
}

function truncate(value: string, max = MAX_DIAGNOSTIC_LENGTH): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 14)}...[truncated]`
}

function summarizeResponseBody(responseBody: unknown) {
  if (typeof responseBody !== 'string') return { present: false }

  const summary: Record<string, unknown> = { length: responseBody.length }

  try {
    const parsed = JSON.parse(responseBody)
    const errorValue = Reflect.get(parsed, 'error')
    const source =
      errorValue !== null && typeof errorValue === 'object'
        ? errorValue
        : parsed

    for (const field of ERROR_FIELDS) {
      const value = Reflect.get(source, field)
      if (typeof value === 'string' || typeof value === 'number') {
        summary[field] = value
      }
    }
  } catch {}

  return summary
}

export function logAPICallErrorDiagnostics(error: unknown): void {
  try {
    if (!APICallError.isInstance(error)) return

    const diagnostics = JSON.stringify({
      statusCode: error.statusCode,
      url: error.url,
      requestBody: summarizeRequestBody(error.requestBodyValues),
      responseBody: summarizeResponseBody(error.responseBody)
    })

    console.error('Provider API call diagnostics:', truncate(diagnostics))
  } catch {}
}
