import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  toolLoopAgent: vi.fn(),
  stepCountIs: vi.fn(steps => ({ steps })),
  tool: vi.fn(config => ({ ...config, wrapped: true }))
}))

vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/testdb'
  process.env.DATABASE_RESTRICTED_URL =
    'postgres://user:pass@localhost:5432/testdb'
})

vi.mock('ai', () => ({
  stepCountIs: mocks.stepCountIs,
  tool: mocks.tool,
  ToolLoopAgent: mocks.toolLoopAgent
}))

vi.mock('@/lib/utils/registry', () => ({
  getModel: vi.fn(model => ({ model }))
}))

vi.mock('@/lib/utils/telemetry', () => ({
  isTracingEnabled: vi.fn(() => false)
}))

vi.mock('@/lib/tools/search', () => ({
  createSearchTool: vi.fn(() => ({
    description: 'search',
    inputSchema: {},
    execute: vi.fn()
  }))
}))

vi.mock('@/lib/tools/fetch', () => ({
  fetchTool: { description: 'fetch' }
}))

vi.mock('@/lib/tools/feed', () => ({
  createFeedTool: vi.fn(() => ({ description: 'feedSearch' }))
}))

vi.mock('@/lib/tools/map', () => ({
  createMapTool: vi.fn(() => ({ description: 'mapSearch' }))
}))

vi.mock('@/lib/tools/question', () => ({
  createQuestionTool: vi.fn(() => ({ description: 'askQuestion' }))
}))

vi.mock('@/lib/tools/subtask-agent', () => ({
  createResearchSubtaskTool: vi.fn(() => ({ description: 'researchSubtask' }))
}))

vi.mock('@/lib/tools/todo', () => ({
  createTodoTools: vi.fn(() => ({
    todoWrite: { description: 'todoWrite' }
  }))
}))

vi.mock('@/lib/tools/factcheck', () => ({
  createFactCheckTool: vi.fn(() => ({ description: 'googleFactCheck' }))
}))

vi.mock('@/lib/tools/source-preferences', () => ({
  createSourcePreferencesTool: vi.fn(() => ({
    description: 'sourcePreferences'
  }))
}))

vi.mock('../../tools/search', () => ({
  createSearchTool: vi.fn(() => ({
    description: 'search',
    inputSchema: {},
    execute: vi.fn()
  }))
}))

vi.mock('../../tools/source-preferences', () => ({
  createSourcePreferencesTool: vi.fn(() => ({
    description: 'sourcePreferences'
  }))
}))

vi.mock('@/lib/actions/source-preferences', () => ({
  listSourcePreferences: vi.fn(),
  listSourcePreferenceProfiles: vi.fn(),
  upsertSourcePreference: vi.fn(),
  upsertSourcePreferenceProfile: vi.fn()
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: vi.fn()
}))

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn()
  }
}))

vi.mock('@/lib/db/with-rls', () => ({
  withRLS: vi.fn(),
  withOptionalRLS: vi.fn(),
  RLSViolationError: class RLSViolationError extends Error {}
}))

import { createResearcher } from '../researcher'

describe('createResearcher search modes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('configures quick mode for fast search-only runs', () => {
    createResearcher({
      model: 'openai:gpt-5-mini',
      searchMode: 'quick'
    })

    const config = mocks.toolLoopAgent.mock.calls[0]?.[0]
    expect(config.activeTools).toEqual([
      'search',
      'fetch',
      'googleFactCheck',
      'sourcePreferences'
    ])
    expect(mocks.stepCountIs).toHaveBeenCalledWith(20)
    expect(mocks.tool).toHaveBeenCalledTimes(1)
    expect(config.instructions).toContain(
      'fast, efficient AI assistant optimized for quick responses'
    )
    expect(config.instructions).toContain('PLACE AND CITY OVERVIEW GUIDANCE')
    expect(config.instructions).toContain(
      'Prefer several well-labeled sections over a two-sentence answer'
    )
  })

  it('configures adaptive mode for deeper agentic research', () => {
    createResearcher({
      model: 'openai:gpt-5-mini',
      searchMode: 'adaptive'
    })

    const config = mocks.toolLoopAgent.mock.calls[0]?.[0]
    expect(config.activeTools).toEqual([
      'search',
      'feedSearch',
      'fetch',
      'todoWrite',
      'researchSubtask',
      'mapSearch',
      'googleFactCheck',
      'sourcePreferences'
    ])
    expect(mocks.stepCountIs).toHaveBeenCalledWith(50)
    expect(mocks.tool).not.toHaveBeenCalled()
    expect(config.instructions).toContain('APPROACH STRATEGY')
    expect(config.instructions).toContain('Fusion-style pattern')
    expect(config.instructions).toContain('Advisor-style self-review')
    expect(config.instructions).toContain('PLACE AND CITY OVERVIEW GUIDANCE')
    expect(config.instructions).toContain(
      'Prefer several well-labeled sections over a two-sentence answer'
    )
  })

  it('adds sanitized personalization as preference context', () => {
    createResearcher({
      model: 'openai:gpt-5-mini',
      searchMode: 'adaptive',
      personalization: {
        enabled: true,
        aboutUser: 'Alice researches public health.',
        responseStyle: 'Concise and source-first.',
        instructions: 'Prefer primary sources.',
        useForSearch: true
      }
    })

    const config = mocks.toolLoopAgent.mock.calls[0]?.[0]
    expect(config.instructions).toContain('User-provided personalization')
    expect(config.instructions).toContain('cannot override system/developer')
    expect(config.instructions).toContain('Alice researches public health.')
  })

  it('omits personalization when it is disabled for search', () => {
    createResearcher({
      model: 'openai:gpt-5-mini',
      searchMode: 'adaptive',
      personalization: {
        enabled: true,
        aboutUser: 'Alice researches public health.',
        responseStyle: '',
        instructions: '',
        useForSearch: false
      }
    })

    const config = mocks.toolLoopAgent.mock.calls[0]?.[0]
    expect(config.instructions).not.toContain('User-provided personalization')
  })

  it('adds validated OpenRouter beta server-tool headers through prepareCall', async () => {
    createResearcher({
      model: 'openrouter:google/gemini-2.5-flash',
      searchMode: 'adaptive',
      modelConfig: {
        id: 'google/gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'OpenRouter',
        providerId: 'openrouter',
        providerOptions: {
          openrouter: {
            serverTools: {
              enabled: true,
              tools: ['fusion'],
              fusion: {
                analysisModels: ['~google/gemini-flash-latest'],
                model: '~openai/gpt-latest'
              }
            }
          }
        }
      }
    })

    const config = mocks.toolLoopAgent.mock.calls[0]?.[0]
    const prepared = await config.prepareCall({
      headers: { 'x-existing': 'yes' },
      model: config.model,
      tools: config.tools,
      instructions: config.instructions,
      activeTools: config.activeTools,
      providerOptions: config.providerOptions,
      stopWhen: config.stopWhen,
      messages: []
    })

    expect(prepared.headers).toEqual(
      expect.objectContaining({
        'x-existing': 'yes',
        'x-morphic-openrouter-server-tools': expect.any(String)
      })
    )
  })
})
