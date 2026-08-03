import { describe, expect, it } from 'vitest'

import { describeStreamError } from '@/lib/streaming/helpers/describe-stream-error'

describe('describeStreamError', () => {
  it('describes a provider billing failure using the public code', () => {
    const error = new Error(
      JSON.stringify({
        type: 'insufficient_quota',
        code: 'credit_balance_exhausted',
        message:
          'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.'
      })
    )

    expect(describeStreamError(error)).toBe(
      'provider_billing: The AI service is currently unavailable.'
    )
  })

  it('does not expose the raw provider message', () => {
    const error = new Error(
      'insufficient_quota: credit_balance_exhausted for account secret-123'
    )
    const description = describeStreamError(error)

    expect(description).toBe(
      'provider_quota: The AI service is currently unavailable.'
    )
    expect(description).not.toContain('secret-123')
  })

  it('does not expose the message of an unclassified error', () => {
    const description = describeStreamError(
      new Error('Unexpected failure for user-content-456')
    )

    expect(description).toBe(
      'unknown: We could not generate a response. Please try again.'
    )
    expect(description).not.toContain('user-content-456')
  })

  it('does not expose the contents of a non-Error value', () => {
    const description = describeStreamError({
      reason: 'provider response body credential-789',
      requestId: 'private-request-id'
    })

    expect(description).not.toContain('credential-789')
    expect(description).not.toContain('private-request-id')
    expect(description.length).toBeGreaterThan(0)
  })

  it('caps a public message that is passed through verbatim', () => {
    const error = JSON.stringify({
      error: `Daily limit reached. ${'Please try again tomorrow. '.repeat(20)}TAIL-MARKER`,
      code: 'rate_limit',
      remaining: 0
    })
    const description = describeStreamError(error)

    expect(description).toHaveLength(300)
    expect(description.startsWith('rate_limit: Daily limit reached.')).toBe(
      true
    )
    expect(description).not.toContain('TAIL-MARKER')
  })
})
