import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearEmergencyRateLimitCounters,
  getRateLimitFailurePolicy,
  recordEmergencyRateLimitAttempt
} from '../failure-policy'

describe('rate limit failure policy', () => {
  beforeEach(() => {
    clearEmergencyRateLimitCounters()
    delete process.env.RATE_LIMIT_FAILURE_MODE
    delete process.env.GUEST_RATE_LIMIT_FAILURE_MODE
    delete process.env.GUEST_RATE_LIMIT_EMERGENCY_CAP
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'true'
  })

  it('uses fail-closed by default for guest limits in cloud deployments', () => {
    expect(getRateLimitFailurePolicy('guest')).toBe('fail-closed')
  })

  it('allows specific limiter policy to override the global policy', () => {
    process.env.RATE_LIMIT_FAILURE_MODE = 'fail-open'
    process.env.GUEST_RATE_LIMIT_FAILURE_MODE = 'emergency-cap'

    expect(getRateLimitFailurePolicy('guest')).toBe('emergency-cap')
  })

  it('caps emergency fallback attempts per limiter and identity', () => {
    process.env.GUEST_RATE_LIMIT_EMERGENCY_CAP = '2'

    expect(recordEmergencyRateLimitAttempt('guest', 'ip-1').allowed).toBe(true)
    expect(recordEmergencyRateLimitAttempt('guest', 'ip-1').allowed).toBe(true)
    expect(recordEmergencyRateLimitAttempt('guest', 'ip-1').allowed).toBe(false)
    expect(recordEmergencyRateLimitAttempt('guest', 'ip-2').allowed).toBe(true)
  })
})
