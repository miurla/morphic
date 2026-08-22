import { describe, expect, it } from 'vitest'

import { isRecoverableSearchError } from '../recoverable-error'

describe('isRecoverableSearchError', () => {
  it.each([408, 429, 500, 503])(
    'accepts recoverable HTTP status %i',
    status => {
      expect(
        isRecoverableSearchError(Object.assign(new Error('failed'), { status }))
      ).toBe(true)
    }
  )

  it.each([400, 401, 403, 404, 422])(
    'rejects client HTTP status %i',
    status => {
      expect(
        isRecoverableSearchError(Object.assign(new Error('failed'), { status }))
      ).toBe(false)
    }
  )

  it('recognizes a network failure through its cause', () => {
    const cause = Object.assign(new Error('connection reset'), {
      code: 'ECONNRESET'
    })

    expect(
      isRecoverableSearchError(new TypeError('fetch failed', { cause }))
    ).toBe(true)
  })

  it('does not treat an arbitrary provider exception as recoverable', () => {
    expect(isRecoverableSearchError(new Error('Invalid query options'))).toBe(
      false
    )
  })
})
