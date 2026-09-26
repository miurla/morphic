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

import { createFetchTool } from '@/lib/tools/fetch'
import { createSearchTool } from '@/lib/tools/search'
import type { SearchResultItem } from '@/lib/types'
import { createCitationLabelAllocator } from '@/lib/utils/citation'

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

function executeGeneralSearch(
  searchDepth = 'basic',
  searchTool = createSearchTool('openai:gpt-4o-mini')
) {
  const result = searchTool.execute?.(
    {
      query: 'current events',
      type: 'general',
      content_types: ['web'],
      max_results: 10,
      search_depth: searchDepth,
      include_domains: [],
      exclude_domains: []
    },
    { toolCallId: 'search-call', messages: [], context: {} }
  )

  return (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()
}

function executeFetch(fetchTool: ReturnType<typeof createFetchTool>) {
  const result = fetchTool.execute?.(
    { url: 'https://example.com/fetched', type: 'regular' },
    { toolCallId: 'fetch-call', messages: [], context: {} }
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
      toolCallId: 'search-call',
      provider: 'tavily',
      fallback: {
        from: 'brave',
        to: 'tavily',
        reason: { type: 'http', status: 429 }
      }
    })
    expect(mocks.braveSearch).toHaveBeenCalledOnce()
    expect(mocks.tavilySearch).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(
      '[Search] dedicated general search provider brave failed with HTTP 429; using optimized search provider: tavily'
    )
  })

  it('allocates disjoint label blocks to parallel searches', async () => {
    const searchTool = createSearchTool('openai:gpt-4o-mini', { labelSeed: 5 })
    mocks.braveSearch.mockImplementation(async () => ({
      ...fallbackResult,
      results: [
        ...fallbackResult.results,
        {
          title: 'Second result',
          content: 'More content',
          url: 'https://example.com/second'
        }
      ]
    }))
    const first = executeGeneralSearch('basic', searchTool)
    const second = executeGeneralSearch('basic', searchTool)

    await Promise.all([first.next(), second.next()])
    const [firstComplete, secondComplete] = await Promise.all([
      first.next(),
      second.next()
    ])
    const firstLabels = (
      firstComplete.value as { results: SearchResultItem[] }
    ).results.map(result => result.label)
    const secondLabels = (
      secondComplete.value as { results: SearchResultItem[] }
    ).results.map(result => result.label)

    expect(firstLabels).toEqual(['S5', 'S6'])
    expect(secondLabels).toEqual(['S7', 'S8'])
  })

  it.each(['search-first', 'fetch-first'] as const)(
    'shares non-overlapping labels when %s',
    async order => {
      const labelAllocator = createCitationLabelAllocator(5)
      const searchTool = createSearchTool('openai:gpt-4o-mini', {
        labelAllocator
      })
      const fetchTool = createFetchTool({ labelAllocator })
      mocks.braveSearch.mockResolvedValue({
        ...fallbackResult,
        results: [
          ...fallbackResult.results,
          {
            title: 'Second result',
            content: 'More content',
            url: 'https://example.com/second'
          }
        ]
      })
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response('Fetched content', {
              headers: { 'content-type': 'text/plain' }
            })
        )
      )

      const search = executeGeneralSearch('basic', searchTool)
      const fetch = executeFetch(fetchTool)
      const first = order === 'search-first' ? search : fetch
      const second = order === 'search-first' ? fetch : search

      await first.next()
      const firstComplete = await first.next()
      await second.next()
      const secondComplete = await second.next()
      const searchComplete =
        order === 'search-first' ? firstComplete : secondComplete
      const fetchComplete =
        order === 'search-first' ? secondComplete : firstComplete
      const searchLabels = (
        searchComplete.value as { results: SearchResultItem[] }
      ).results.map(result => result.label)
      const fetchLabels = (
        fetchComplete.value as { results: SearchResultItem[] }
      ).results.map(result => result.label)

      expect(searchLabels).toEqual(
        order === 'search-first' ? ['S5', 'S6'] : ['S6', 'S7']
      )
      expect(fetchLabels).toEqual(order === 'search-first' ? ['S7'] : ['S5'])
    }
  )

  it('uses the optimized provider after a transport failure', async () => {
    mocks.braveSearch.mockRejectedValue(new TypeError('fetch failed'))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const iterator = executeGeneralSearch()

    await iterator.next()
    const complete = await iterator.next()

    expect(mocks.tavilySearch).toHaveBeenCalledOnce()
    expect(complete.value).toMatchObject({
      provider: 'tavily',
      fallback: {
        from: 'brave',
        to: 'tavily',
        reason: { type: 'transport' }
      }
    })
  })

  it('logs a recoverable HTTP status found on a nested cause', async () => {
    const cause = Object.assign(new Error('upstream unavailable'), {
      status: 503
    })
    mocks.braveSearch.mockRejectedValue(new Error('search failed', { cause }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const iterator = executeGeneralSearch()

    await iterator.next()
    await iterator.next()

    expect(warn).toHaveBeenCalledWith(
      '[Search] dedicated general search provider brave failed with HTTP 503; using optimized search provider: tavily'
    )
  })

  it('normalizes an empty search depth to basic', async () => {
    mocks.braveSearch.mockResolvedValue(fallbackResult)
    const iterator = executeGeneralSearch('')

    await iterator.next()
    await iterator.next()

    expect(mocks.braveSearch).toHaveBeenCalledWith(
      'current events',
      10,
      'basic',
      [],
      [],
      expect.any(Object)
    )
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
