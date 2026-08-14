import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getToolFailureMessage,
  serializeToolFailure,
  ToolFailureError
} from '@/lib/errors/tool-error'

import { SearXNGSearchProvider } from '../searxng'
import { TavilySearchProvider } from '../tavily'

describe('search provider HTTP errors', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('preserves HTTP status details for classification', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          new Response(null, { status: 403, statusText: 'Forbidden' })
        )
      )
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const error = await new TavilySearchProvider()
      .search('private query', 5, 'basic', [], [])
      .catch(error => error)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('HTTP 403: Forbidden')
    expect(error.status).toBe(403)

    const toolError = new ToolFailureError('search', error)
    expect(getToolFailureMessage(toolError)).toBe(
      'The search service refused the request.'
    )
    expect(JSON.parse(serializeToolFailure(toolError))).toMatchObject({
      error: 'The search service refused the request.',
      retryable: false
    })
  })

  it('classifies rate limiting as retryable', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key')
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

    const error = await new TavilySearchProvider()
      .search('private query', 5, 'basic', [], [])
      .catch(error => error)
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

  it('does not include the query or upstream body', async () => {
    const query = 'private model-authored query'
    const responseBody = 'private upstream response body'
    vi.stubEnv('SEARXNG_API_URL', 'https://search.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          new Response(responseBody, {
            status: 403,
            statusText: 'Forbidden'
          })
        )
      )
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const error = await new SearXNGSearchProvider()
      .search(query, 5, 'basic', [], [])
      .catch(error => error)

    expect(error.message).not.toContain(query)
    expect(error.message).not.toContain(responseBody)
    expect(error.message).toContain('HTTP 403: Forbidden')
  })

  it('uses a fallback for an empty status text', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(new Response(null, { status: 503, statusText: '' }))
      )
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const error = await new TavilySearchProvider()
      .search('private query', 5, 'basic', [], [])
      .catch(error => error)

    expect(error.message).toBe('Tavily search failed: HTTP 503: Unknown Status')
  })
})
