import { describe, expect, it } from 'vitest'

import { createEphemeralChatStreamResponse } from '@/lib/streaming/create-ephemeral-chat-stream-response'

describe('createEphemeralChatStreamResponse', () => {
  it('returns 400 when messages are missing', async () => {
    const response = await createEphemeralChatStreamResponse({
      messages: [],
      model: { providerId: 'openai', id: 'gpt-4o-mini' } as any,
      abortSignal: new AbortController().signal,
      searchMode: 'quick',
      modelType: 'speed'
    })

    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).toBe('messages are required')
  })
})
