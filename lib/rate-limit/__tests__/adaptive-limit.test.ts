import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkAndEnforceAdaptiveLimit } from '@/lib/rate-limit/adaptive-limit'

const mockRedisIncr = vi.fn()
const mockRedisExpire = vi.fn()
const mockTrack = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    incr: mockRedisIncr,
    expire: mockRedisExpire
  }))
}))

vi.mock('@vercel/analytics/server', () => ({
  track: (...args: unknown[]) => mockTrack(...args)
}))

describe('checkAndEnforceAdaptiveLimit', () => {
  beforeEach(() => {
    mockRedisIncr.mockReset()
    mockRedisExpire.mockReset()
    mockTrack.mockReset()
    mockTrack.mockResolvedValue(undefined)
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'true'
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    delete process.env.ADAPTIVE_CHAT_DAILY_LIMIT
  })

  it('allows requests under the default limit', async () => {
    mockRedisIncr.mockResolvedValue(5)
    mockRedisExpire.mockResolvedValue(1)

    const response = await checkAndEnforceAdaptiveLimit('user-1')
    expect(response).toBeNull()
  })

  it('returns 429 when the default 30/day limit is exceeded', async () => {
    mockRedisIncr.mockResolvedValue(31)
    mockRedisExpire.mockResolvedValue(1)

    const response = await checkAndEnforceAdaptiveLimit('user-2')
    expect(response).not.toBeNull()
    expect(response?.status).toBe(429)

    const body = await response!.json()
    expect(body.limit).toBe(30)
    expect(body.mode).toBe('adaptive')
    expect(body.remaining).toBe(0)
    expect(typeof body.error).toBe('string')
  })

  it('honors ADAPTIVE_CHAT_DAILY_LIMIT override', async () => {
    process.env.ADAPTIVE_CHAT_DAILY_LIMIT = '5'
    mockRedisIncr.mockResolvedValue(6)
    mockRedisExpire.mockResolvedValue(1)

    const response = await checkAndEnforceAdaptiveLimit('user-3')
    expect(response?.status).toBe(429)
    const body = await response!.json()
    expect(body.limit).toBe(5)
  })

  it('sets TTL only on first increment of the day', async () => {
    mockRedisIncr.mockResolvedValue(1)
    mockRedisExpire.mockResolvedValue(1)

    await checkAndEnforceAdaptiveLimit('user-4')
    expect(mockRedisExpire).toHaveBeenCalledTimes(1)

    mockRedisExpire.mockClear()
    mockRedisIncr.mockResolvedValue(2)

    await checkAndEnforceAdaptiveLimit('user-4')
    expect(mockRedisExpire).not.toHaveBeenCalled()
  })

  it('allows the request when redis fails (fail-open)', async () => {
    mockRedisIncr.mockRejectedValue(new Error('boom'))

    const response = await checkAndEnforceAdaptiveLimit('user-5')
    expect(response).toBeNull()
  })

  it('skips enforcement when not in cloud deployment', async () => {
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'false'
    mockRedisIncr.mockResolvedValue(9999)

    const response = await checkAndEnforceAdaptiveLimit('user-6')
    expect(response).toBeNull()
    expect(mockRedisIncr).not.toHaveBeenCalled()
  })

  it('emits an "allowed" analytics event when under the limit', async () => {
    mockRedisIncr.mockResolvedValue(7)
    mockRedisExpire.mockResolvedValue(1)

    await checkAndEnforceAdaptiveLimit('user-7')

    // Allow the void-fired track promise to resolve.
    await new Promise(resolve => setImmediate(resolve))

    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith('adaptive_limit_check', {
      outcome: 'allowed',
      userId: 'user-7',
      used: 7,
      limit: 30
    })
  })

  it('emits a "blocked" analytics event when over the limit', async () => {
    mockRedisIncr.mockResolvedValue(31)
    mockRedisExpire.mockResolvedValue(1)

    await checkAndEnforceAdaptiveLimit('user-8')

    await new Promise(resolve => setImmediate(resolve))

    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith('adaptive_limit_check', {
      outcome: 'blocked',
      userId: 'user-8',
      used: 31,
      limit: 30
    })
  })

  it('does not emit analytics when redis is unavailable (no enforcement)', async () => {
    mockRedisIncr.mockRejectedValue(new Error('boom'))

    await checkAndEnforceAdaptiveLimit('user-9')

    await new Promise(resolve => setImmediate(resolve))

    expect(mockTrack).not.toHaveBeenCalled()
  })
})
