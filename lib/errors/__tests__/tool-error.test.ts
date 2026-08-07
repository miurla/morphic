import { describe, expect, it } from 'vitest'

import {
  getToolFailureMessage,
  isToolFailureError,
  serializeToolFailure,
  ToolFailureError
} from '@/lib/errors/tool-error'

describe('tool error mapping', () => {
  it.each([
    ['HTTP 403: Forbidden', 'The page refused the request.'],
    ['Forbidden by upstream', 'The page refused the request.'],
    ['HTTP 404: Not Found', 'The page could not be found.'],
    [
      'HTTP 429: Too Many Requests',
      'The page is rate limiting requests. Please try again shortly.'
    ],
    [
      'HTTP 500: Internal Server Error',
      'The page is temporarily unavailable. Please try again shortly.'
    ],
    [
      'Service unavailable',
      'The page is temporarily unavailable. Please try again shortly.'
    ],
    ['Request timeout after 10 seconds', 'The page took too long to respond.'],
    ['The request was aborted', 'The page took too long to respond.'],
    [
      'Unsupported content type: application/pdf',
      'The page is not in a readable text format.'
    ],
    [
      'No results returned from content extraction service',
      'The page did not return any readable content.'
    ],
    [
      'No data returned from Jina Reader API',
      'The page did not return any readable content.'
    ]
  ])('maps %s to scoped copy', (message, expected) => {
    expect(getToolFailureMessage(new ToolFailureError('fetch', message))).toBe(
      expected
    )
  })

  it('uses a fetch-specific unknown fallback', () => {
    expect(
      getToolFailureMessage(new ToolFailureError('fetch', 'Unexpected failure'))
    ).toBe('The page could not be read.')
  })

  it('uses a search-specific unknown fallback', () => {
    expect(
      getToolFailureMessage(
        new ToolFailureError('search', 'Unexpected failure')
      )
    ).toBe('The search could not be completed.')
  })

  it('recognizes markers without relying only on instanceof', () => {
    expect(
      isToolFailureError({
        isToolFailureError: true,
        toolName: 'fetch',
        originalMessage: 'failed'
      })
    ).toBe(true)
    expect(isToolFailureError(new Error('failed'))).toBe(false)
  })

  it('scopes the copy to the search service', () => {
    expect(
      getToolFailureMessage(
        new ToolFailureError('search', 'HTTP 403: Forbidden')
      )
    ).toBe('The search service refused the request.')
  })

  it('does not mark a refusal as retryable', () => {
    const payload = JSON.parse(
      serializeToolFailure(new ToolFailureError('fetch', 'HTTP 403: Forbidden'))
    )

    expect(payload.retryable).toBe(false)
  })

  it('serializes a tool_failed public payload', () => {
    const payload = JSON.parse(
      serializeToolFailure(new ToolFailureError('search', 'Unexpected failure'))
    )

    expect(payload).toMatchObject({
      code: 'tool_failed',
      type: 'general',
      error: 'The search could not be completed.'
    })
  })
})
