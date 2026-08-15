import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getToolFailureMessage,
  serializeToolFailure,
  ToolFailureError
} from '@/lib/errors/tool-error'

import { BraveSearchProvider } from '../brave'

describe('BraveSearchProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('surfaces a classified failure when every requested search fails', async () => {
    vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          new Response(null, {
            status: 429,
            statusText: 'Too Many Requests'
          })
        )
      )
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const error = await new BraveSearchProvider()
      .search('query', 5, 'basic', [], [], {
        content_types: ['web', 'image']
      })
      .catch(error => error)

    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(429)

    const toolError = new ToolFailureError('search', error)
    expect(getToolFailureMessage(toolError)).toBe(
      'The search service is rate limiting requests. Please try again shortly.'
    )
    expect(JSON.parse(serializeToolFailure(toolError))).toMatchObject({
      error:
        'The search service is rate limiting requests. Please try again shortly.',
      retryable: true
    })
  })

  it('returns partial results when at least one requested search succeeds', async () => {
    vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        if (input.toString().includes('/images/')) {
          return new Response(null, {
            status: 503,
            statusText: 'Service Unavailable'
          })
        }

        return Response.json({
          web: {
            results: [
              {
                title: 'Result title',
                description: 'Result description',
                url: 'https://example.com/result'
              }
            ]
          }
        })
      })
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const result = await new BraveSearchProvider().search(
      'query',
      5,
      'basic',
      [],
      [],
      { content_types: ['web', 'image'] }
    )

    expect(result.results).toEqual([
      {
        title: 'Result title',
        content: 'Result description',
        url: 'https://example.com/result'
      }
    ])
    expect(result.images).toEqual([])
    expect(result.number_of_results).toBe(1)
  })
})
