import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  checkRateLimit,
  rateLimitKeyCount,
  resetRateLimits
} from '../rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimits()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows ten attempts and blocks the eleventh within a window', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      expect(checkRateLimit('sign-in:1.2.3.4:a@b.co')).toBe(true)
    }
    expect(checkRateLimit('sign-in:1.2.3.4:a@b.co')).toBe(false)
  })

  it('allows again once the window passes', () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      checkRateLimit('sign-in:1.2.3.4:a@b.co')
    }
    expect(checkRateLimit('sign-in:1.2.3.4:a@b.co')).toBe(false)

    vi.advanceTimersByTime(60_001)

    expect(checkRateLimit('sign-in:1.2.3.4:a@b.co')).toBe(true)
  })

  it('tracks keys independently', () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      checkRateLimit('sign-in:1.2.3.4:a@b.co')
    }

    // A different account from the same IP, or the same account from a
    // different IP, keeps its own budget.
    expect(checkRateLimit('sign-in:1.2.3.4:victim@b.co')).toBe(true)
    expect(checkRateLimit('sign-in:5.6.7.8:a@b.co')).toBe(true)
    expect(checkRateLimit('sign-up:1.2.3.4:a@b.co')).toBe(true)
  })

  it('evicts the oldest keys when the cap is reached within one window', () => {
    for (let attempt = 0; attempt < 11; attempt++) {
      checkRateLimit('sign-in:oldest@b.co')
    }
    expect(checkRateLimit('sign-in:oldest@b.co')).toBe(false)

    for (let index = 0; index < 20_000; index++) {
      checkRateLimit(`sign-in:10.0.0.${index}:a@b.co`)
    }

    expect(rateLimitKeyCount()).toBeLessThanOrEqual(10_000)
    // The newest key survives with its count; the oldest lost its window.
    for (let attempt = 0; attempt < 9; attempt++) {
      expect(checkRateLimit('sign-in:10.0.0.19999:a@b.co')).toBe(true)
    }
    expect(checkRateLimit('sign-in:10.0.0.19999:a@b.co')).toBe(false)
    expect(checkRateLimit('sign-in:oldest@b.co')).toBe(true)
  })

  it('drops expired keys before live ones at the cap', () => {
    for (let index = 0; index < 9_999; index++) {
      checkRateLimit(`sign-in:stale-${index}`)
    }
    vi.advanceTimersByTime(60_001)
    for (let attempt = 0; attempt < 11; attempt++) {
      checkRateLimit('sign-in:live@b.co')
    }

    checkRateLimit('sign-in:overflow@b.co')

    expect(rateLimitKeyCount()).toBe(2)
    expect(checkRateLimit('sign-in:live@b.co')).toBe(false)
  })
})
