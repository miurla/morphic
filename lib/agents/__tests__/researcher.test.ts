import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  toolLoopAgent: vi.fn(),
  stepCountIs: vi.fn(steps => ({ steps })),
  tool: vi.fn(config => ({ ...config, wrapped: true }))
}))

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
    expect(config.activeTools).toEqual(['search', 'fetch'])
    expect(mocks.stepCountIs).toHaveBeenCalledWith(20)
    expect(mocks.tool).toHaveBeenCalledTimes(1)
    expect(config.instructions).toContain(
      'fast, efficient AI assistant optimized for quick responses'
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
      'mapSearch'
    ])
    expect(mocks.stepCountIs).toHaveBeenCalledWith(50)
    expect(mocks.tool).not.toHaveBeenCalled()
    expect(config.instructions).toContain('APPROACH STRATEGY')
  })
})
