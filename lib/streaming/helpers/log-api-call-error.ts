import { APICallError } from 'ai'

const MAX_DIAGNOSTIC_LENGTH = 4000
const MAX_RESPONSE_BODY_LENGTH = 1000

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
  const messages = Reflect.get(requestBodyValues, 'messages')

  return {
    topLevelKeys,
    totalSerializedSize,
    ...(Array.isArray(messages) && {
      messageCount: messages.length,
      messages: messages.map(message => {
        if (message === null || typeof message !== 'object') {
          return { role: 'unknown', content: summarizeContent(message) }
        }

        return {
          role: summarizeRole(Reflect.get(message, 'role')),
          content: summarizeContent(Reflect.get(message, 'content'))
        }
      })
    })
  }
}

function truncate(value: string, max = MAX_DIAGNOSTIC_LENGTH): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 14)}...[truncated]`
}

export function logAPICallErrorDiagnostics(error: unknown): void {
  try {
    if (!APICallError.isInstance(error)) return

    const diagnostics = JSON.stringify({
      statusCode: error.statusCode,
      url: error.url,
      requestBody: summarizeRequestBody(error.requestBodyValues),
      responseBody:
        typeof error.responseBody === 'string'
          ? truncate(error.responseBody, MAX_RESPONSE_BODY_LENGTH)
          : error.responseBody
    })

    console.error('Provider API call diagnostics:', truncate(diagnostics))
  } catch {}
}
