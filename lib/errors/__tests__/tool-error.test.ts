import { describe, expect, it } from 'vitest'

import {
  getToolFailureMessage,
  INVALID_URL_SENTINEL,
  isToolFailureError,
  isToolFailureMessage,
  serializeToolFailure,
  ToolFailureError
} from '@/lib/errors/tool-error'

describe('tool error mapping', () => {
  it('maps an invalid fetch URL to non-retryable scoped copy', () => {
    const expected = 'The link is not a valid web address.'
    const error = new ToolFailureError('fetch', INVALID_URL_SENTINEL)

    expect(getToolFailureMessage(error)).toBe(expected)
    // Membership is what lets the copy survive the client's re-parse.
    expect(isToolFailureMessage(expected)).toBe(true)
    expect(JSON.parse(serializeToolFailure(error))).toMatchObject({
      error: expected,
      retryable: false
    })
  })

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

describe('tool failure copy', () => {
  it('only recognizes sentences the mapper can produce', () => {
    expect(isToolFailureMessage('The page refused the request.')).toBe(true)
    expect(isToolFailureMessage('Something else entirely.')).toBe(false)
  })

  it.each([
    ['fetch', 'HTTP 403: Forbidden'],
    ['fetch', 'HTTP 404: Not Found'],
    ['fetch', 'HTTP 429: Too Many Requests'],
    ['fetch', 'HTTP 503: Service Temporarily Unavailable'],
    ['fetch', 'Request timeout after 10 seconds'],
    ['fetch', 'Unsupported content type: application/pdf'],
    ['fetch', 'No results returned from content extraction service'],
    ['fetch', 'Unexpected failure'],
    ['search', 'HTTP 403: Forbidden'],
    ['search', 'HTTP 429: Too Many Requests'],
    ['search', 'Unexpected failure']
  ] as const)(
    'keeps %s copy for %s inside the known set',
    (toolName, message) => {
      expect(
        isToolFailureMessage(
          getToolFailureMessage(new ToolFailureError(toolName, message))
        )
      ).toBe(true)
    }
  )
})
