import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkRateLimit, resetRateLimits } from '../rate-limit'

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
})
