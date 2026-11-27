import { APICallError, ToolLoopAgent } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { describe, expect, it } from 'vitest'

import { serializePublicError } from '@/lib/errors/public-error'
import { describeStreamError } from '@/lib/streaming/helpers/describe-stream-error'

const CONTEXT_WINDOW_ERROR = new APICallError({
  message:
    'Your input exceeds the context window of this model. Please adjust your input and try again.',
  url: 'https://api.openai.com/v1/responses',
  requestBodyValues: {},
  statusCode: 400,
  isRetryable: false
})

describe('stream error round trip through the UI message stream', () => {
  // With onEnd set, the SDK reports the error chunk to onError again as
  // new Error(errorText), so the last error the handler sees is the copy it
  // serialized itself. The trace is described from that last error.
  it('describes the serialized copy the SDK hands back with the specific copy', async () => {
    const agent = new ToolLoopAgent({
      model: new MockLanguageModelV3({
        doStream: async () => {
          throw CONTEXT_WINDOW_ERROR
        }
      })
    })

    const result = await agent.stream({
      messages: [{ role: 'user', content: 'hello' }]
    })
    result.consumeStream()

    const seen: unknown[] = []
    const response = result.toUIMessageStreamResponse({
      onEnd: async () => {},
      onError: error => {
        seen.push(error)
        return serializePublicError(error)
      }
    })
    await response.text()

    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe(CONTEXT_WINDOW_ERROR)
    expect(describeStreamError(seen[1])).toBe(
      'context_length: This conversation is too long for the selected model. Start a new chat or shorten your message.'
    )
  })
})
