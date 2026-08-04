import type { StreamTextOnErrorCallback } from 'ai'
import { ToolLoopAgent } from 'ai'
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'

describe('ToolLoopAgent onError forwarding', () => {
  it('forwards onError to streamText', async () => {
    const streamError = new Error('stream failed')
    const onError = vi.fn()
    const agent = new ToolLoopAgent({
      model: new MockLanguageModelV3({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'error', error: streamError },
              {
                type: 'finish',
                usage: {
                  inputTokens: {
                    total: 1,
                    noCache: 1,
                    cacheRead: 0,
                    cacheWrite: 0
                  },
                  outputTokens: {
                    total: 0,
                    text: 0,
                    reasoning: 0
                  }
                },
                finishReason: { unified: 'error', raw: 'mock-error' }
              }
            ]
          })
        })
      })
    })

    const result = await agent.stream({
      messages: [{ role: 'user', content: 'hello' }],
      onError
    } as Parameters<typeof agent.stream>[0] & {
      onError: StreamTextOnErrorCallback
    })
    await result.consumeStream()

    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith({ error: streamError })
  })
})
