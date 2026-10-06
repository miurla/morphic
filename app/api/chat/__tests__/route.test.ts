import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { checkAndEnforceGuestLimit } from '@/lib/rate-limit/guest-limit'
import { createChatStreamResponse } from '@/lib/streaming/create-chat-stream-response'
import { createEphemeralChatStreamResponse } from '@/lib/streaming/create-ephemeral-chat-stream-response'
import { selectModel } from '@/lib/utils/model-selection'

import { POST } from '../route'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: vi.fn() }))
}))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/analytics', () => ({ trackChatEvent: vi.fn() }))
vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: vi.fn(),
  getCurrentUserId: vi.fn()
}))
vi.mock('@/lib/auth/provider', () => ({
  isAnonymousMode: vi.fn(() => false)
}))
vi.mock('@/lib/db/actions', () => ({ getUserMessageIds: vi.fn() }))
vi.mock('@/lib/db/schema', () => ({ generateId: vi.fn(() => 'message-id') }))
vi.mock('@/lib/rate-limit/adaptive-limit', () => ({
  checkAndEnforceAdaptiveLimit: vi.fn()
}))
vi.mock('@/lib/rate-limit/chat-limits', () => ({
  checkAndEnforceOverallChatLimit: vi.fn()
}))
vi.mock('@/lib/rate-limit/guest-limit', () => ({
  checkAndEnforceGuestLimit: vi.fn()
}))
vi.mock('@/lib/streaming/create-chat-stream-response', () => ({
  createChatStreamResponse: vi.fn()
}))
vi.mock('@/lib/streaming/create-ephemeral-chat-stream-response', () => ({
  createEphemeralChatStreamResponse: vi.fn()
}))
vi.mock('@/lib/usage-budget', () => ({
  isUsageBudgetAvailable: vi.fn(() => false)
}))
vi.mock('@/lib/utils/model-selection', () => ({ selectModel: vi.fn() }))
vi.mock('@/lib/utils/perf-logging', () => ({
  perfLog: vi.fn(),
  perfTime: vi.fn()
}))
vi.mock('@/lib/utils/registry', () => ({
  isProviderEnabled: vi.fn(() => true)
}))

const message = {
  id: 'user-message',
  role: 'user',
  parts: [{ type: 'text', text: 'Hello' }]
}
const model = {
  id: 'test-model',
  name: 'Test Model',
  providerId: 'openai',
  provider: 'OpenAI'
}

function request(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      messages: [message],
      trigger: 'submit-message',
      isNewChat: true,
      ...overrides
    })
  })
}

describe('POST /api/chat guest message validation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('ENABLE_AUTH', 'true')
    vi.stubEnv('ENABLE_GUEST_CHAT', 'true')
    vi.stubEnv('MORPHIC_CLOUD_DEPLOYMENT', 'false')
    vi.stubEnv('ENABLE_PERF_LOGGING', 'false')
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(selectModel).mockResolvedValue(model)
    vi.mocked(createEphemeralChatStreamResponse).mockImplementation(
      async () => new Response('guest stream')
    )
    vi.mocked(createChatStreamResponse).mockImplementation(
      async () => new Response('authenticated stream')
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each([
    ['null message', null],
    ['string message', 'hello'],
    ['number message', 42],
    ['boolean message', true],
    ['array message', []],
    ['missing role', { parts: [] }],
    ['null role', { role: null, parts: [] }],
    ['non-string role', { role: 42, parts: [] }],
    ['missing parts', { role: 'user' }],
    ['null parts', { role: 'user', parts: null }],
    ['string parts', { role: 'user', parts: 'hello' }],
    ['object parts', { role: 'user', parts: {} }],
    ['null part', { role: 'user', parts: [null] }],
    ['string part', { role: 'user', parts: ['hello'] }],
    ['number part', { role: 'user', parts: [42] }],
    ['boolean part', { role: 'user', parts: [true] }],
    ['array part', { role: 'user', parts: [[]] }],
    ['missing part type', { role: 'user', parts: [{}] }],
    ['null part type', { role: 'user', parts: [{ type: null }] }],
    ['non-string part type', { role: 'user', parts: [{ type: 42 }] }]
  ])('rejects %s before entering the stream', async (_name, malformed) => {
    const response = await POST(request({ messages: [malformed] }))

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Invalid message structure')
    expect(checkAndEnforceGuestLimit).toHaveBeenCalled()
    expect(selectModel).toHaveBeenCalled()
    expect(createEphemeralChatStreamResponse).not.toHaveBeenCalled()
  })

  it('rejects a malformed message later in valid history', async () => {
    const response = await POST(request({ messages: [message, null] }))

    expect(response.status).toBe(400)
    expect(createEphemeralChatStreamResponse).not.toHaveBeenCalled()
  })

  it('rejects a malformed part after a valid part', async () => {
    const response = await POST(
      request({
        messages: [{ ...message, parts: [...message.parts, null] }]
      })
    )

    expect(response.status).toBe(400)
    expect(createEphemeralChatStreamResponse).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', undefined],
    ['null', null],
    ['string', 'hello'],
    ['object', {}],
    ['empty', []]
  ])(
    'retains the bad-request response for %s history',
    async (_name, messages) => {
      const response = await POST(request({ messages }))

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('messages are required')
      expect(createEphemeralChatStreamResponse).not.toHaveBeenCalled()
    }
  )

  it('passes valid history to the guest stream unchanged', async () => {
    const messages = [message]
    const response = await POST(request({ messages }))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('guest stream')
    expect(createEphemeralChatStreamResponse).toHaveBeenCalledExactlyOnceWith({
      messages,
      model,
      abortSignal: expect.any(AbortSignal),
      searchMode: 'quick',
      chatId: undefined
    })
  })

  it('accepts custom data and tool parts without requiring message IDs', async () => {
    const messages = [
      {
        role: 'assistant',
        parts: [
          { type: 'data-custom', data: { value: 1 } },
          {
            type: 'tool-custom',
            toolCallId: 'call',
            state: 'output-available',
            input: {},
            output: {}
          },
          {
            type: 'dynamic-tool',
            toolName: 'custom',
            toolCallId: 'dynamic-call',
            state: 'input-available',
            input: {}
          }
        ]
      },
      { role: 'user', parts: [] }
    ]
    const response = await POST(request({ messages }))

    expect(response.status).toBe(200)
    expect(createEphemeralChatStreamResponse).toHaveBeenCalledWith(
      expect.objectContaining({ messages })
    )
  })

  it('preserves authenticated submissions without guest history', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-id'
    } as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>)
    const response = await POST(request({ messages: undefined }))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('authenticated stream')
    expect(createChatStreamResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        message,
        userId: 'user-id',
        trigger: 'submit-message'
      })
    )
    expect(createEphemeralChatStreamResponse).not.toHaveBeenCalled()
  })
})
