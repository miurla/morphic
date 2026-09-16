import { describe, expect, it } from 'vitest'

import { usageLimitResponse } from '../response'

describe('usage limit response', () => {
  it('returns a machine-readable monthly 429 response', async () => {
    const resetAt = Date.now() + 60_000
    const response = usageLimitResponse({
      allowed: false,
      duplicate: false,
      monthUsed: 100,
      hourUsed: 2,
      remaining: 0,
      reason: 'monthly',
      retryAt: resetAt,
      cost: 1,
      limit: 100,
      resetAt,
      enforced: true
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('X-Usage-Remaining')).toBe('0')
    await expect(response.json()).resolves.toMatchObject({
      type: 'rate-limit',
      code: 'usage_limit',
      usageLimitReached: true,
      reason: 'monthly'
    })
  })

  it('does not disguise an hourly guard as exhausted monthly usage', async () => {
    const resetAt = Date.now() + 10 * 24 * 60 * 60 * 1000
    const retryAt = Date.now() + 30 * 60 * 1000
    const response = usageLimitResponse({
      allowed: false,
      duplicate: false,
      monthUsed: 25,
      hourUsed: 31,
      remaining: 175,
      reason: 'hourly',
      retryAt,
      cost: 1,
      limit: 200,
      resetAt,
      enforced: true
    })

    expect(response.headers.get('X-Usage-Remaining')).toBe('175')
    await expect(response.json()).resolves.toMatchObject({
      reason: 'hourly',
      remaining: 175,
      resetAt,
      retryAt
    })
  })
})
