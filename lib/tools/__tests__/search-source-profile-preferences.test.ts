import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SearchResults } from '@/lib/types'

const mockSearch = vi.fn()
const mockBlendConfiguredFeedResults = vi.fn()
const mockGetCurrentUserId = vi.fn()
const mockListSourcePreferenceProfiles = vi.fn()
const mockListSourcePreferences = vi.fn()

const providerResults: SearchResults = {
  query: 'climate attribution research',
  images: [],
  results: [
    {
      title: 'General explainer',
      url: 'https://example.com/climate',
      content: 'General climate information.'
    },
    {
      title: 'IPCC report',
      url: 'https://ipcc.ch/report/ar6',
      content: 'Primary assessment report.'
    },
    {
      title: 'NIH health result',
      url: 'https://nih.gov/health',
      content: 'Health result that belongs to another profile.'
    }
  ],
  number_of_results: 3
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn()
    })
  )
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: () => mockGetCurrentUserId()
}))

vi.mock('@/lib/actions/source-preferences', () => ({
  listSourcePreferenceProfiles: (...args: unknown[]) =>
    mockListSourcePreferenceProfiles(...args),
  listSourcePreferences: (...args: unknown[]) =>
    mockListSourcePreferences(...args)
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

describe('search tool source preference profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearch.mockResolvedValue(providerResults)
    mockBlendConfiguredFeedResults.mockResolvedValue(providerResults)
    mockGetCurrentUserId.mockResolvedValue('user_123')
    mockListSourcePreferenceProfiles.mockResolvedValue({
      success: true,
      profiles: [
        {
          id: 'profile_climate',
          name: 'Climate',
          slug: 'climate',
          settings: { includeTerms: ['climate'], excludeTerms: [] },
          isActive: true
        },
        {
          id: 'profile_health',
          name: 'Health',
          slug: 'health',
          settings: { includeTerms: ['health'], excludeTerms: [] },
          isActive: true
        }
      ]
    })
    mockListSourcePreferences.mockResolvedValue({
      success: true,
      preferences: [
        {
          id: 'pref_global',
          domain: 'example.com',
          target: 'example.com',
          targetType: 'domain',
          preference: 'prefer',
          profileId: null
        },
        {
          id: 'pref_climate',
          domain: 'ipcc.ch',
          target: 'ipcc.ch',
          targetType: 'domain',
          preference: 'trust',
          profileId: 'profile_climate'
        },
        {
          id: 'pref_health',
          domain: 'nih.gov',
          target: 'nih.gov',
          targetType: 'domain',
          preference: 'block',
          profileId: 'profile_health'
        }
      ]
    })
  })

  it('applies global preferences plus the matched profile preferences', async () => {
    const tool = createSearchTool('openai:gpt-4o-mini')
    const result = await tool.execute?.(
      {
        query: 'climate attribution research',
        type: 'general',
        content_types: ['web'],
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

    const finalChunk = chunks.at(-1) as SearchResults
    expect(finalChunk.results.map(result => result.url)).toEqual([
      'https://ipcc.ch/report/ar6',
      'https://example.com/climate',
      'https://nih.gov/health'
    ])
    expect(finalChunk.results[0].sourcePreference).toEqual({
      preference: 'trust',
      matchedBy: 'domain',
      matchedValue: 'ipcc.ch'
    })
    expect(finalChunk.results[2].sourcePreference).toBeUndefined()
  })
})
