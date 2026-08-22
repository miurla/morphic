import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  braveSearch: vi.fn(),
  createSearchProvider: vi.fn(),
  tavilySearch: vi.fn()
}))

vi.mock('@/lib/tools/search/providers', () => ({
  createSearchProvider: mocks.createSearchProvider,
  DEFAULT_PROVIDER: 'tavily'
}))

import { createSearchTool } from '@/lib/tools/search'

const fallbackResult = {
  results: [
    {
      title: 'Fallback result',
      content: 'Fallback content',
      url: 'https://example.com/result'
    }
  ],
  images: [],
  query: 'current events',
  number_of_results: 1
}

function executeGeneralSearch() {
  const result = createSearchTool('openai:gpt-4o-mini').execute?.(
    {
      query: 'current events',
      type: 'general',
      content_types: ['web'],
      max_results: 10,
      search_depth: 'basic',
      include_domains: [],
      exclude_domains: []
    },
    { toolCallId: 'search-call', messages: [], context: {} }
  )

  return (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()
}

describe('general search provider fallback', () => {
  beforeEach(() => {
    vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-key')
    vi.stubEnv('SEARCH_API', 'tavily')
    mocks.createSearchProvider.mockImplementation(provider => ({
      search: provider === 'brave' ? mocks.braveSearch : mocks.tavilySearch
    }))
    mocks.tavilySearch.mockResolvedValue(fallbackResult)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('uses the optimized provider after the general provider is rate limited', async () => {
    mocks.braveSearch.mockRejectedValue(
      Object.assign(new Error('Brave search failed: HTTP 429'), { status: 429 })
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const iterator = executeGeneralSearch()

    await iterator.next()
    const complete = await iterator.next()

    expect(complete.value).toMatchObject({
      state: 'complete',
      results: fallbackResult.results,
      toolCallId: 'search-call'
    })
    expect(mocks.braveSearch).toHaveBeenCalledOnce()
    expect(mocks.tavilySearch).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(
      '[Search] dedicated general search provider brave failed with HTTP 429; using optimized search provider: tavily'
    )
  })

  it('uses the optimized provider after a transport failure', async () => {
    mocks.braveSearch.mockRejectedValue(new TypeError('fetch failed'))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const iterator = executeGeneralSearch()

    await iterator.next()
    await iterator.next()

    expect(mocks.tavilySearch).toHaveBeenCalledOnce()
  })

  it('does not fall back for a client error', async () => {
    mocks.braveSearch.mockRejectedValue(
      Object.assign(new Error('Brave search failed: HTTP 400'), { status: 400 })
    )
    const iterator = executeGeneralSearch()

    await iterator.next()

    await expect(iterator.next()).rejects.toMatchObject({
      name: 'ToolFailureError',
      status: 400
    })
    expect(mocks.tavilySearch).not.toHaveBeenCalled()
  })

  it('does not retry the same provider as a fallback', async () => {
    vi.stubEnv('SEARCH_API', 'brave')
    mocks.braveSearch.mockRejectedValue(
      Object.assign(new Error('Brave search failed: HTTP 429'), { status: 429 })
    )
    const iterator = executeGeneralSearch()

    await iterator.next()

    await expect(iterator.next()).rejects.toMatchObject({
      name: 'ToolFailureError',
      status: 429
    })
    expect(mocks.braveSearch).toHaveBeenCalledOnce()
  })
})
