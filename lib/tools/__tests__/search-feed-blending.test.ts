import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SearchResults } from '@/lib/types'

const providerResults: SearchResults = {
  query: 'latest space news',
  images: [],
  results: [
    {
      title: 'Search item',
      url: 'https://example.com/search',
      content: 'Search content'
    }
  ],
  number_of_results: 1
}

const blendedResults: SearchResults = {
  ...providerResults,
  results: [
    ...providerResults.results,
    {
      title: 'Feed item',
      url: 'https://example.com/feed-item',
      content: 'Feed content'
    }
  ],
  number_of_results: 2
}

const mockSearch = vi.fn()
const mockBlendConfiguredFeedResults = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn()
    })
  )
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: vi.fn(() => Promise.resolve(null))
}))

vi.mock('@/lib/entities/knowledge-graph', () => ({
  enrichSearchResultsWithKnowledgeGraph: vi.fn((results: unknown) =>
    Promise.resolve(results)
  )
}))

vi.mock('@/lib/actions/source-preferences', () => ({
  listSourcePreferences: vi.fn(() =>
    Promise.resolve({ success: false, preferences: [] })
  ),
  listSourcePreferenceProfiles: vi.fn(() =>
    Promise.resolve({ success: false, profiles: [] })
  )
}))

vi.mock('../search/providers', () => ({
  DEFAULT_PROVIDER: 'qwant',
  createSearchProvider: vi.fn(() => ({
    search: mockSearch
  }))
}))

vi.mock('../search/feed-blending', () => ({
  blendConfiguredFeedResults: (...args: unknown[]) =>
    mockBlendConfiguredFeedResults(...args)
}))

import { createSearchTool } from '../search'

describe('search tool feed blending', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearch.mockResolvedValue(providerResults)
    mockBlendConfiguredFeedResults.mockResolvedValue(blendedResults)
  })

  it('passes search results through feed blending before yielding complete output', async () => {
    const tool = createSearchTool('openai:gpt-4o-mini')
    const result = await tool.execute?.(
      {
        query: 'latest space news',
        type: 'general',
        content_types: ['news'],
        max_results: 10,
        search_depth: 'basic',
        include_domains: [],
        exclude_domains: []
      },
      {
        toolCallId: 'search-call',
        messages: []
      }
    )

    const chunks = []
    if (result && Symbol.asyncIterator in result) {
      for await (const chunk of result) {
        chunks.push(chunk)
      }
    }

    expect(mockBlendConfiguredFeedResults).toHaveBeenCalledWith(
      providerResults,
      {
        query: 'latest space news',
        contentTypes: ['news']
      }
    )
    expect(chunks.at(-1)).toEqual({
      state: 'complete',
      ...blendedResults,
      toolCallId: 'search-call',
      citationMap: {
        1: blendedResults.results[0],
        2: blendedResults.results[1]
      }
    })
  })
})
