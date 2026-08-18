import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  span: {
    traceId: 'trace-id',
    update: vi.fn(),
    end: vi.fn()
  },
  forceFlush: vi.fn(),
  finishPromise: Promise.resolve()
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

vi.mock('@/lib/actions/chat', () => ({
  loadChat: vi.fn()
}))

vi.mock('@/lib/agents/researcher', () => ({
  researcher: vi.fn(() => ({ stream: mocks.stream }))
}))

vi.mock('@/lib/agents/title-generator', () => ({
  generateChatTitle: vi.fn(async () => 'Title')
}))

vi.mock('@/lib/streaming/helpers/attachment-sizes', () => ({
  resolveAttachmentSizes: vi.fn(async (messages: unknown) => messages)
}))

vi.mock('@/lib/streaming/helpers/persist-stream-results', () => ({
  persistStreamResults: vi.fn(async () => undefined)
}))

vi.mock('@/lib/streaming/helpers/prepare-messages', () => ({
  prepareMessages: vi.fn(async () => [])
}))

vi.mock('@/lib/utils/telemetry', () => ({
  isTracingEnabled: vi.fn(() => true)
}))

vi.mock('@/lib/utils/usage-logging', () => ({
  isUsageLogging: vi.fn(() => false),
  logUsage: vi.fn()
}))

import { researcher } from '@/lib/agents/researcher'
import { createChatStreamResponse } from '@/lib/streaming/create-chat-stream-response'
import { describeStreamError } from '@/lib/streaming/helpers/describe-stream-error'
import { prepareMessages } from '@/lib/streaming/helpers/prepare-messages'

type StreamOptions = {
  onError: (event: { error: unknown }) => void
}

type UIMessageStreamResponseOptions = {
  onEnd: (event: {
    responseMessage: {
      id: string
      role: 'assistant'
      parts: Array<{ type: string; text?: string }>
    }
    isAborted: boolean
  }) => Promise<void>
}

function createFakeResult(isAborted = false) {
  return {
    consumeStream: vi.fn(),
    toUIMessageStreamResponse: vi.fn(
      (options: UIMessageStreamResponseOptions) => {
        mocks.finishPromise = options.onEnd({
          responseMessage: {
            id: 'response-id',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Answer' }]
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
    message: {
      id: 'message-id',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'hello' }]
    },
    model: { providerId: 'openai', id: 'gpt-4o-mini' } as any,
    chatId: 'chat-id',
    userId: 'user-id',
    abortSignal,
    isNewChat: true,
    searchMode: 'quick' as const
  }
}

describe('createChatStreamResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.finishPromise = Promise.resolve()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('passes the chat ID to the researcher', async () => {
    mocks.stream.mockResolvedValue(createFakeResult())

    await createChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(researcher).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 'chat-id' })
    )
  })

  it('does not mark the span as failed for an aborted stream error', async () => {
    const streamError = new Error('request stopped')
    streamError.name = 'ResponseAborted'
    mocks.stream.mockImplementation(async (options: StreamOptions) => {
      options.onError({ error: streamError })
      return createFakeResult(true)
    })

    await createChatStreamResponse(createConfig(createAbortedSignal()))
    await mocks.finishPromise

    expect(mocks.span.update).not.toHaveBeenCalled()
    expect(mocks.span.end).toHaveBeenCalledOnce()
    expect(mocks.forceFlush).toHaveBeenCalledOnce()
  })

  it('marks the span as failed when the client disconnects after the failure', async () => {
    const streamError = new Error('upstream stopped')
    streamError.name = 'AbortError'
    const controller = new AbortController()
    mocks.stream.mockImplementation(async (options: StreamOptions) => {
      options.onError({ error: streamError })
      controller.abort()
      return createFakeResult()
    })

    await createChatStreamResponse(createConfig(controller.signal))
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      level: 'ERROR',
      statusMessage: describeStreamError(streamError),
      metadata: {
        streamErrorPhase: 'generation',
        streamErrorShape: { name: 'AbortError' }
      }
    })
  })

  it('marks a failure raised before the stream as the preparation phase', async () => {
    const prepareError = new TypeError('private failure detail')
    vi.mocked(prepareMessages).mockRejectedValueOnce(prepareError)

    await createChatStreamResponse(createConfig())

    expect(mocks.span.update).toHaveBeenCalledWith({
      level: 'ERROR',
      statusMessage: describeStreamError(prepareError),
      metadata: {
        streamErrorPhase: 'preparation',
        streamErrorShape: { name: 'TypeError' }
      }
    })
    expect(mocks.stream).not.toHaveBeenCalled()
  })

  it('attaches shape metadata for an unclassified stream error', async () => {
    const streamError = Object.assign(new Error('private failure detail'), {
      name: 'StreamFailure',
      errno: 91
    })
    mocks.stream.mockImplementation(async (options: StreamOptions) => {
      options.onError({ error: streamError })
      return createFakeResult()
    })

    await createChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      level: 'ERROR',
      statusMessage: describeStreamError(streamError),
      metadata: {
        streamErrorPhase: 'generation',
        streamErrorShape: {
          name: 'StreamFailure',
          errno: 91
        }
      }
    })
    expect(JSON.stringify(mocks.span.update.mock.calls)).not.toContain(
      'private failure detail'
    )
  })
})
