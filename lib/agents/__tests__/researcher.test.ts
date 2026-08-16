import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Model } from '@/lib/types/models'

import { RELATED_QUESTIONS_REMINDER } from '../prompts/related-questions-reminder'

const mocks = vi.hoisted(() => ({
  agentOptions: undefined as Record<string, any> | undefined
}))

vi.mock('ai', () => ({
  stepCountIs: vi.fn(),
  tool: vi.fn(options => options),
  ToolLoopAgent: vi.fn(function (
    this: { tools: unknown },
    options: Record<string, any>
  ) {
    mocks.agentOptions = options
    this.tools = options.tools
  })
}))

vi.mock('@/lib/tools/fetch', () => ({
  fetchTool: {}
}))

vi.mock('@/lib/tools/question', () => ({
  createQuestionTool: vi.fn(() => ({}))
}))

vi.mock('@/lib/tools/search', () => ({
  createSearchTool: vi.fn(() => ({}))
}))

vi.mock('@/lib/tools/todo', () => ({
  createTodoTools: vi.fn(() => ({ todoWrite: {} }))
}))

vi.mock('@/lib/utils/registry', () => ({
  getModel: vi.fn(() => ({}))
}))

vi.mock('@/lib/utils/telemetry', () => ({
  isTracingEnabled: vi.fn(() => false)
}))

vi.mock('../prompts/search-mode-prompts', () => ({
  getAdaptiveModePrompt: vi.fn(() => 'Adaptive prompt'),
  QUICK_MODE_PROMPT: 'Quick prompt'
}))

import { createResearcher } from '../researcher'

function createModel(
  providerId: string,
  providerOptions?: Model['providerOptions']
): Model {
  return {
    id: 'model-id',
    name: 'Model',
    provider: 'Provider',
    providerId,
    providerOptions
  }
}

describe('createResearcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.agentOptions = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('adds the chat ID to existing OpenAI provider options', () => {
    createResearcher({
      model: 'openai:model-id',
      modelConfig: createModel('openai', {
        openai: { reasoningEffort: 'low' },
        custom: { enabled: true }
      }),
      chatId: 'chat-id'
    })

    expect(mocks.agentOptions?.providerOptions).toEqual({
      openai: {
        reasoningEffort: 'low',
        promptCacheKey: 'chat-id'
      },
      custom: { enabled: true }
    })
  })

  it('does not add OpenAI options for another provider', () => {
    createResearcher({
      model: 'google:model-id',
      modelConfig: createModel('google', {
        google: { thinkingConfig: { thinkingBudget: 1024 } }
      }),
      chatId: 'chat-id'
    })

    expect(mocks.agentOptions?.providerOptions).toEqual({
      google: { thinkingConfig: { thinkingBudget: 1024 } }
    })
  })

  it('preserves OpenAI options when no chat ID is available', () => {
    createResearcher({
      model: 'openai:model-id',
      modelConfig: createModel('openai', {
        openai: { reasoningEffort: 'low' }
      })
    })

    expect(mocks.agentOptions?.providerOptions).toEqual({
      openai: { reasoningEffort: 'low' }
    })
  })

  it('places the related-questions reminder after conversation history', () => {
    createResearcher({
      model: 'openai:model-id',
      modelConfig: createModel('openai')
    })

    const prepareCall = mocks.agentOptions?.prepareCall
    const result = prepareCall({
      messages: [
        { role: 'user', content: 'Initial question' },
        { role: 'assistant', content: 'Initial answer' },
        { role: 'user', content: 'Deep follow-up' }
      ]
    })

    expect(result.messages.at(-1)).toEqual({
      role: 'user',
      content: [{ type: 'text', text: RELATED_QUESTIONS_REMINDER }]
    })
    expect(result.messages.at(-2)).toEqual({
      role: 'user',
      content: 'Deep follow-up'
    })
  })
})
