import { describe, expect, it } from 'vitest'

import { classifyRecoverableSearchError } from '../recoverable-error'

describe('classifyRecoverableSearchError', () => {
  it.each([408, 429, 500, 503])(
    'accepts recoverable HTTP status %i',
    status => {
      expect(
        classifyRecoverableSearchError(
          Object.assign(new Error('failed'), { status })
        )
      ).toEqual({ type: 'http', status })
    }
  )

  it.each([400, 401, 403, 404, 422])(
    'rejects client HTTP status %i',
    status => {
      expect(
        classifyRecoverableSearchError(
          Object.assign(new Error('failed'), { status })
        )
      ).toBeNull()
    }
  )

  it('classifies a network failure through its cause', () => {
    const cause = Object.assign(new Error('connection reset'), {
      code: 'ECONNRESET'
    })

    expect(
      classifyRecoverableSearchError(new TypeError('fetch failed', { cause }))
    ).toEqual({ type: 'transport' })
  })

  it('preserves an HTTP status found on a nested cause', () => {
    const cause = Object.assign(new Error('upstream unavailable'), {
      status: 503
    })

    expect(
      classifyRecoverableSearchError(new Error('failed', { cause }))
    ).toEqual({ type: 'http', status: 503 })
  })

  it('does not treat an arbitrary provider exception as recoverable', () => {
    expect(
      classifyRecoverableSearchError(new Error('Invalid query options'))
    ).toBeNull()
  })
})
