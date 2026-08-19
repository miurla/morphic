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
import { EMPTY_RESPONSE_STATUS_MESSAGE } from '@/lib/streaming/helpers/is-empty-response'
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

function createFakeResult(
  isAborted = false,
  parts: Array<{ type: string; text?: string }> = [
    { type: 'text', text: 'Answer' }
  ]
) {
  return {
    consumeStream: vi.fn(),
    toUIMessageStreamResponse: vi.fn(
      (options: UIMessageStreamResponseOptions) => {
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

function createConfigWithParts(parts: unknown[]) {
  const config = createConfig()

  return {
    ...config,
    message: { ...config.message, parts: parts as typeof config.message.parts }
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

    expect(mocks.span.update).toHaveBeenCalledWith({ input: 'hello' })
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

    expect(mocks.span.update).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'ERROR',
        statusMessage: describeStreamError(streamError),
        metadata: {
          streamErrorPhase: 'generation',
          streamErrorShape: { name: 'AbortError' }
        }
      })
    )
  })

  it('marks a failure raised before the stream as the preparation phase', async () => {
    const prepareError = new TypeError('private failure detail')
    vi.mocked(prepareMessages).mockRejectedValueOnce(prepareError)

    await createChatStreamResponse(createConfig())

    expect(mocks.span.update).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'ERROR',
        statusMessage: describeStreamError(prepareError),
        metadata: {
          streamErrorPhase: 'preparation',
          streamErrorStage: 'prepare-messages',
          streamErrorShape: { name: 'TypeError' }
        }
      })
    )
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

    expect(mocks.span.update).toHaveBeenCalledWith(
      expect.objectContaining({
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
    )
    expect(JSON.stringify(mocks.span.update.mock.calls)).not.toContain(
      'private failure detail'
    )
  })

  it('records the user message and the finished answer on the root span', async () => {
    mocks.stream.mockResolvedValue(createFakeResult())

    await createChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: 'hello',
      output: 'Answer'
    })
  })

  it('omits the output when the answer is only whitespace', async () => {
    mocks.stream.mockResolvedValue(
      createFakeResult(false, [{ type: 'text', text: '   \n' }])
    )

    await createChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: 'hello',
      level: 'ERROR',
      statusMessage: EMPTY_RESPONSE_STATUS_MESSAGE
    })
  })

  it('omits the output when the stream failed after partial text', async () => {
    const streamError = new Error('upstream stopped')
    streamError.name = 'AbortError'
    mocks.stream.mockImplementation(async (options: StreamOptions) => {
      options.onError({ error: streamError })
      return createFakeResult(false, [{ type: 'text', text: 'Partial ans' }])
    })

    await createChatStreamResponse(createConfig())
    await mocks.finishPromise

    const update = mocks.span.update.mock.calls.at(-1)?.[0]
    expect(update).toMatchObject({ input: 'hello', level: 'ERROR' })
    expect(update).not.toHaveProperty('output')
  })

  it('keeps the input and omits the output for an aborted turn', async () => {
    mocks.stream.mockResolvedValue(createFakeResult(true))

    await createChatStreamResponse(createConfig(createAbortedSignal()))
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({ input: 'hello' })
  })

  it('takes the input from the prepared messages when the turn has no message', async () => {
    vi.mocked(prepareMessages).mockResolvedValueOnce([
      {
        id: 'earlier-user',
        role: 'user',
        parts: [{ type: 'text', text: 'earlier question' }]
      },
      {
        id: 'earlier-assistant',
        role: 'assistant',
        parts: [{ type: 'text', text: 'earlier answer' }]
      }
    ] as any)
    mocks.stream.mockResolvedValue(createFakeResult())

    await createChatStreamResponse({
      ...createConfig(),
      message: null,
      trigger: 'regenerate-assistant-message' as const
    })
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: 'earlier question',
      output: 'Answer'
    })
  })

  it('describes a file-only turn on the root span input', async () => {
    mocks.stream.mockResolvedValue(createFakeResult())

    await createChatStreamResponse(
      createConfigWithParts([
        {
          type: 'file',
          filename: 'report.pdf',
          mediaType: 'application/pdf',
          url: 'https://example.com/report.pdf'
        }
      ])
    )
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: '"report.pdf" (application/pdf)',
      output: 'Answer'
    })
  })

  it('describes a pasted-content-only turn without its content', async () => {
    mocks.stream.mockResolvedValue(createFakeResult())

    await createChatStreamResponse(
      createConfigWithParts([
        { type: 'data-pastedContent', data: { text: 'secret'.repeat(100) } }
      ])
    )
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: 'pasted content (600 characters)',
      output: 'Answer'
    })
    expect(JSON.stringify(mocks.span.update.mock.calls)).not.toContain('secret')
  })

  it('keeps the URL of a URL-card-only turn', async () => {
    mocks.stream.mockResolvedValue(createFakeResult())

    await createChatStreamResponse(
      createConfigWithParts([
        { type: 'data-sourceUrl', data: { url: 'https://example.com/a' } }
      ])
    )
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: 'URL card: https://example.com/a',
      output: 'Answer'
    })
  })

  it('describes both a file and pasted content on the same turn', async () => {
    mocks.stream.mockResolvedValue(createFakeResult())

    await createChatStreamResponse(
      createConfigWithParts([
        {
          type: 'file',
          filename: 'notes.txt',
          mediaType: 'text/plain',
          url: 'https://example.com/notes.txt'
        },
        { type: 'data-pastedContent', data: { text: 'ab' } }
      ])
    )
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: '"notes.txt" (text/plain), pasted content (2 characters)',
      output: 'Answer'
    })
  })

  it('describes the structured parts of the prepared history on a regenerate turn', async () => {
    vi.mocked(prepareMessages).mockResolvedValueOnce([
      {
        id: 'earlier-user',
        role: 'user',
        parts: [
          {
            type: 'file',
            filename: 'earlier.png',
            mediaType: 'image/png',
            url: 'https://example.com/earlier.png'
          }
        ]
      }
    ] as any)
    mocks.stream.mockResolvedValue(createFakeResult())

    await createChatStreamResponse({
      ...createConfig(),
      message: null,
      trigger: 'regenerate-assistant-message' as const
    })
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: '"earlier.png" (image/png)',
      output: 'Answer'
    })
  })

  it('leaves the input unset for a turn with no parts', async () => {
    mocks.stream.mockResolvedValue(createFakeResult())

    await createChatStreamResponse(createConfigWithParts([]))
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({ output: 'Answer' })
  })

  it('keeps the empty-response failure alongside the root span input', async () => {
    mocks.stream.mockResolvedValue(createFakeResult(false, []))

    await createChatStreamResponse(createConfig())
    await mocks.finishPromise

    expect(mocks.span.update).toHaveBeenCalledWith({
      input: 'hello',
      level: 'ERROR',
      statusMessage: EMPTY_RESPONSE_STATUS_MESSAGE
    })
  })
})
