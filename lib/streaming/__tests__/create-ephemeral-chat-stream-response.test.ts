import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  span: {
    traceId: 'trace-id',
    update: vi.fn(),
    end: vi.fn()
  },
  forceFlush: vi.fn(),
  finishPromise: Promise.resolve(),
  serializedError: undefined as string | undefined
}))

vi.mock('ai', () => ({
  consumeStream: vi.fn(),
  convertToModelMessages: vi.fn(async () => []),
  smoothStream: vi.fn()
}))

vi.mock('@langfuse/tracing', () => ({
  propagateAttributes: vi.fn((_attributes: unknown, callback: () => unknown) =>
    callback()
  ),
  startActiveObservation: vi.fn(
    (_name: string, callback: (span: typeof mocks.span) => unknown) =>
      callback(mocks.span)
  )
}))

vi.mock('@/instrumentation', () => ({
  langfuseSpanProcessor: {
    forceFlush: mocks.forceFlush
  }
}))

vi.mock('@/lib/agents/researcher', () => ({
  researcher: vi.fn(() => ({ stream: mocks.stream }))
}))

vi.mock('@/lib/utils/telemetry', () => ({
  isTracingEnabled: vi.fn(() => true)
}))

vi.mock('@/lib/utils/usage-logging', () => ({
  isUsageLogging: vi.fn(() => false),
  logUsage: vi.fn()
}))

import { serializeToolFailure, ToolFailureError } from '@/lib/errors/tool-error'
import { createEphemeralChatStreamResponse } from '@/lib/streaming/create-ephemeral-chat-stream-response'
import { describeStreamError } from '@/lib/streaming/helpers/describe-stream-error'
import { EMPTY_RESPONSE_STATUS_MESSAGE } from '@/lib/streaming/helpers/is-empty-response'

type StreamOptions = {
  onError: (event: { error: unknown }) => void
}

type UIMessageStreamResponseOptions = {
  onError: (error: unknown) => string
  onFinish: (event: {
    responseMessage: {
      id: string
      role: 'assistant'
      parts: Array<{ type: string; text?: string }>
    }
    isAborted: boolean
  }) => Promise<void>
}

function createFakeResult({
  toolError,
  parts = [{ type: 'text', text: 'Answer' }],
  isAborted = false
}: {
  toolError?: unknown
  parts?: Array<{ type: string; text?: string }>
  isAborted?: boolean
} = {}) {
  return {
    consumeStream: vi.fn(),
    toUIMessageStreamResponse: vi.fn(
      (options: UIMessageStreamResponseOptions) => {
        if (toolError) {
          mocks.serializedError = options.onError(toolError)
        }
        mocks.finishPromise = options.onFinish({
          responseMessage: {
            id: 'response-id',
            role: 'assistant',
            parts
          },
          isAborted
        })
        return new Response()
      }
    )
  }
}

function createConfig() {
  return {
    messages: [
      {
        id: 'message-id',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'hello' }]
      }
    ],
    model: { providerId: 'openai', id: 'gpt-4o-mini' } as any,
    abortSignal: new AbortController().signal,
    searchMode: 'quick' as const
  }
}

describe('createEphemeralChatStreamResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.finishPromise = Promise.resolve()
    mocks.serializedError = undefined
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 400 when messages are missing', async () => {
    const response = await createEphemeralChatStreamResponse({
      ...createConfig(),
      messages: []
    })

    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).toBe('messages are required')
  })

  it('does not mark the span as failed for a tool error', async () => {
    const toolError = new ToolFailureError(
      'fetch',
      new Error('HTTP 403: Forbidden')
    )
    mocks.stream.mockResolvedValue(createFakeResult({ toolError }))

    await createEphemeralChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.serializedError).toBe(serializeToolFailure(toolError))
    expect(mocks.span.update).not.toHaveBeenCalled()
    expect(mocks.span.end).toHaveBeenCalledOnce()
    expect(mocks.forceFlush).toHaveBeenCalledOnce()
  })

  it('marks the span as failed for a stream-level error', async () => {
    const streamError = new Error('stream failed')
    mocks.stream.mockImplementation(async (options: StreamOptions) => {
      options.onError({ error: streamError })
      return createFakeResult()
    })

    await createEphemeralChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      level: 'ERROR',
      statusMessage: describeStreamError(streamError)
    })
    expect(mocks.span.end).toHaveBeenCalledOnce()
    expect(mocks.forceFlush).toHaveBeenCalledOnce()
  })

  it('marks the span as failed for an empty response', async () => {
    mocks.stream.mockResolvedValue(createFakeResult({ parts: [] }))

    await createEphemeralChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      level: 'ERROR',
      statusMessage: EMPTY_RESPONSE_STATUS_MESSAGE
    })
  })

  it('does not update the span for a response with text', async () => {
    mocks.stream.mockResolvedValue(createFakeResult())

    await createEphemeralChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.span.update).not.toHaveBeenCalled()
  })

  it('does not update the span for an aborted turn', async () => {
    mocks.stream.mockResolvedValue(
      createFakeResult({ parts: [], isAborted: true })
    )

    await createEphemeralChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.span.update).not.toHaveBeenCalled()
  })

  it('preserves the stream error when the response is empty', async () => {
    const streamError = new Error('stream failed')
    mocks.stream.mockImplementation(async (options: StreamOptions) => {
      options.onError({ error: streamError })
      return createFakeResult({ parts: [] })
    })

    await createEphemeralChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledOnce()
    expect(mocks.span.update).toHaveBeenCalledWith({
      level: 'ERROR',
      statusMessage: describeStreamError(streamError)
    })
  })
})
