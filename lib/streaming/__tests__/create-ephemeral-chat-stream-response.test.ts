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

import { researcher } from '@/lib/agents/researcher'
import { serializeToolFailure, ToolFailureError } from '@/lib/errors/tool-error'
import { createEphemeralChatStreamResponse } from '@/lib/streaming/create-ephemeral-chat-stream-response'
import { describeStreamError } from '@/lib/streaming/helpers/describe-stream-error'
import { EMPTY_RESPONSE_STATUS_MESSAGE } from '@/lib/streaming/helpers/is-empty-response'

type StreamOptions = {
  onError: (event: { error: unknown }) => void
}

type UIMessageStreamResponseOptions = {
  onError: (error: unknown) => string
  onEnd: (event: {
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
        mocks.finishPromise = options.onEnd({
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

function createAbortedSignal(): AbortSignal {
  const controller = new AbortController()
  controller.abort()

  return controller.signal
}

function createConfig(abortSignal: AbortSignal = new AbortController().signal) {
  return {
    messages: [
      {
        id: 'message-id',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'hello' }]
      }
    ],
    model: { providerId: 'openai', id: 'gpt-4o-mini' } as any,
    chatId: 'chat-id',
    abortSignal,
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

  it('passes the chat ID to the researcher', async () => {
    mocks.stream.mockResolvedValue(createFakeResult())

    await createEphemeralChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(researcher).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 'chat-id' })
    )
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
    expect(mocks.span.update).toHaveBeenCalledWith({
      input: 'hello',
      output: 'Answer'
    })
    expect(mocks.span.end).toHaveBeenCalledOnce()
    expect(mocks.forceFlush).toHaveBeenCalledOnce()
  })

  it('attaches shape metadata for an unclassified stream error', async () => {
    const streamError = Object.assign(new Error('stream failed'), {
      name: 'StreamFailure',
      code: 'STREAM_CODE'
    })
    mocks.stream.mockImplementation(async (options: StreamOptions) => {
      options.onError({ error: streamError })
      return createFakeResult()
    })

    await createEphemeralChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'ERROR',
        statusMessage: describeStreamError(streamError),
        metadata: {
          streamErrorPhase: 'generation',
          streamErrorShape: {
            name: 'StreamFailure',
            code: 'STREAM_CODE'
          }
        }
      })
    )
    expect(mocks.span.end).toHaveBeenCalledOnce()
    expect(mocks.forceFlush).toHaveBeenCalledOnce()
  })

  it('omits the output when the stream failed after partial text', async () => {
    const streamError = new Error('upstream stopped')
    streamError.name = 'AbortError'
    mocks.stream.mockImplementation(async (options: StreamOptions) => {
      options.onError({ error: streamError })
      return createFakeResult({
        parts: [{ type: 'text', text: 'Partial ans' }]
      })
    })

    await createEphemeralChatStreamResponse(createConfig())
    await mocks.finishPromise

    const update = mocks.span.update.mock.calls.at(-1)?.[0]
    expect(update).toMatchObject({ input: 'hello', level: 'ERROR' })
    expect(update).not.toHaveProperty('output')
  })

  it('does not mark the span as failed for an aborted stream error', async () => {
    const streamError = new Error('request stopped')
    streamError.name = 'AbortError'
    mocks.stream.mockImplementation(async (options: StreamOptions) => {
      options.onError({ error: streamError })
      return createFakeResult({ isAborted: true })
    })

    await createEphemeralChatStreamResponse(createConfig(createAbortedSignal()))
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({ input: 'hello' })
    expect(mocks.span.end).toHaveBeenCalledOnce()
    expect(mocks.forceFlush).toHaveBeenCalledOnce()
  })

  it('marks the span as failed for an empty response', async () => {
    mocks.stream.mockResolvedValue(createFakeResult({ parts: [] }))

    await createEphemeralChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: 'hello',
      level: 'ERROR',
      statusMessage: EMPTY_RESPONSE_STATUS_MESSAGE
    })
  })

  it('does not mark the span as failed for a response with text', async () => {
    mocks.stream.mockResolvedValue(createFakeResult())

    await createEphemeralChatStreamResponse(createConfig(createAbortedSignal()))
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: 'hello',
      output: 'Answer'
    })
  })

  it('keeps the input and omits the output for an aborted turn', async () => {
    mocks.stream.mockResolvedValue(
      createFakeResult({ parts: [], isAborted: true })
    )

    await createEphemeralChatStreamResponse(createConfig(createAbortedSignal()))
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({ input: 'hello' })
  })

  it('takes the input from the last user message of the history', async () => {
    mocks.stream.mockResolvedValue(createFakeResult())

    await createEphemeralChatStreamResponse({
      ...createConfig(),
      messages: [
        {
          id: 'first-user',
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: 'first question' }]
        },
        {
          id: 'first-assistant',
          role: 'assistant' as const,
          parts: [{ type: 'text' as const, text: 'first answer' }]
        },
        {
          id: 'second-user',
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: 'second question' }]
        }
      ]
    })
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: 'second question',
      output: 'Answer'
    })
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
      input: 'hello',
      level: 'ERROR',
      statusMessage: describeStreamError(streamError),
      metadata: {
        streamErrorPhase: 'generation',
        streamErrorShape: { name: 'Error' }
      }
    })
  })
})
