import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  eval: vi.fn(),
  hgetall: vi.fn(),
  redisSignals: [] as AbortSignal[],
  syncUsageGrants: vi.fn(),
  resolveUsageAnchor: vi.fn(),
  getCurrentUser: vi.fn()
}))

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(config: { signal?: AbortSignal }) {
      if (config.signal) mocks.redisSignals.push(config.signal)
    }

    get = mocks.get
    set = mocks.set
    eval = mocks.eval
    hgetall = mocks.hgetall
  }
}))

vi.mock('../grants', () => ({
  resolveUsageAnchor: mocks.resolveUsageAnchor,
  syncUsageGrants: mocks.syncUsageGrants
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: mocks.getCurrentUser
}))

import {
  consumeUsage,
  getUsageBudget,
  refundUsage,
  USAGE_GATE_SCRIPT,
  USAGE_REFUND_SCRIPT
} from '../gate'

describe('usage budget gate', () => {
  const originalEnv = { ...process.env }
  const now = new Date('2026-09-20T12:30:00.000Z')
  const anchor = new Date('2026-01-20T12:00:00.000Z')
  const resetAt = Date.parse('2026-10-20T12:00:00.000Z')

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.redisSignals.length = 0
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'true'
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    mocks.resolveUsageAnchor.mockResolvedValue(anchor)
    mocks.syncUsageGrants.mockResolvedValue({
      monthly: 100,
      monthlyExpiresAt: new Date(resetAt)
    })
    mocks.get.mockImplementation((key: string) => {
      if (key.startsWith('ub:v2:g:')) return `100|${resetAt}`
      return null
    })
    mocks.hgetall.mockResolvedValue({
      period_spend_key: 'ub:v2:p:user-1:original-period',
      hourly_spend_key: 'ub:v2:h:user-1:2026-09-20-12'
    })
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.useRealTimers()
  })

  it('bypasses Redis outside Morphic Cloud', async () => {
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'false'

    const result = await consumeUsage({
      userId: 'user-1',
      mode: 'quick',
      attemptId: 'attempt-1',
      now
    })

    expect(result.allowed).toBe(true)
    expect(result.enforced).toBe(false)
    expect(mocks.eval).not.toHaveBeenCalled()
  })

  it('bypasses Redis when Upstash is not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const result = await consumeUsage({
      userId: 'user-1',
      mode: 'quick',
      attemptId: 'attempt-unconfigured',
      now
    })

    expect(result.allowed).toBe(true)
    expect(result.enforced).toBe(false)
    expect(mocks.eval).not.toHaveBeenCalled()
  })

  it('uses one Lua evaluation for the anniversary-period budget', async () => {
    mocks.eval.mockResolvedValue([1, 0, 1, 1, 99, '', 1, 100, resetAt, resetAt])

    const result = await consumeUsage({
      userId: 'user-1',
      mode: 'quick',
      attemptId: 'attempt-1',
      now
    })

    expect(result).toMatchObject({
      allowed: true,
      duplicate: false,
      remaining: 99,
      limit: 100,
      enforced: true
    })
    expect(mocks.eval).toHaveBeenCalledTimes(1)
    const [, keys, args] = mocks.eval.mock.calls[0]
    expect(keys).toEqual([
      `ub:v2:p:user-1:${Date.parse('2026-09-20T12:00:00.000Z')}`,
      'ub:v2:h:user-1:2026-09-20-12',
      'ub:v2:a:user-1:attempt-1',
      `ub:v2:g:user-1:${Date.parse('2026-09-20T12:00:00.000Z')}`
    ])
    expect(args[5]).toBeGreaterThanOrEqual(35 * 24 * 60 * 60)
    expect(args.slice(6)).toEqual([
      resetAt,
      Date.parse('2026-09-20T13:00:00.000Z')
    ])
  })

  it('replays a cross-boundary duplicate before syncing the new grant', async () => {
    mocks.eval.mockResolvedValue([
      1,
      1,
      100,
      1,
      0,
      '',
      1,
      100,
      Date.parse('2026-09-20T12:00:00.000Z'),
      Date.parse('2026-09-20T12:00:00.000Z')
    ])

    const result = await consumeUsage({
      userId: 'user-1',
      mode: 'quick',
      attemptId: 'attempt-from-previous-period',
      now
    })

    expect(result.duplicate).toBe(true)
    expect(mocks.eval).toHaveBeenCalledTimes(1)
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.syncUsageGrants).not.toHaveBeenCalled()
  })

  it('syncs and retries once when a new period grant is missing', async () => {
    mocks.eval
      .mockResolvedValueOnce([-1, 0, 0, 0, 0, '', 1, 0, resetAt, resetAt])
      .mockResolvedValueOnce([1, 0, 1, 1, 99, '', 1, 100, resetAt, resetAt])
    mocks.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(`100|${resetAt}`)

    const result = await consumeUsage({
      userId: 'user-1',
      mode: 'quick',
      attemptId: 'attempt-new-period',
      now
    })

    expect(result.remaining).toBe(99)
    expect(mocks.syncUsageGrants).toHaveBeenCalledTimes(1)
    expect(mocks.eval).toHaveBeenCalledTimes(2)
  })

  it('preserves monthly remaining and exposes the hourly retry boundary', async () => {
    mocks.eval.mockResolvedValue([
      0,
      0,
      25,
      31,
      75,
      'hourly',
      1,
      100,
      resetAt,
      Date.parse('2026-09-20T13:00:00.000Z')
    ])

    const result = await consumeUsage({
      userId: 'user-1',
      mode: 'quick',
      attemptId: 'attempt-hourly',
      now
    })

    expect(result.reason).toBe('hourly')
    expect(result.remaining).toBe(75)
    expect(result.retryAt).toBe(Date.parse('2026-09-20T13:00:00.000Z'))
    expect(result.resetAt).toBe(resetAt)
  })

  it('returns the anniversary reset as the snapshot refresh boundary', async () => {
    const usage = await getUsageBudget({
      userId: 'user-1',
      userCreatedAt: anchor,
      now
    })

    expect(usage).toEqual({
      remaining: 100,
      limit: 100,
      resetAt,
      refreshAt: resetAt,
      costs: { quick: 1, adaptive: 2 }
    })
  })

  it('fails open when trusted created_at is missing', async () => {
    mocks.resolveUsageAnchor.mockResolvedValue(null)

    const result = await consumeUsage({
      userId: 'user-1',
      mode: 'quick',
      attemptId: 'attempt-no-anchor',
      now
    })

    expect(result.allowed).toBe(true)
    expect(result.enforced).toBe(false)
    expect(result.resetAt).toBe(0)
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('fails open when Redis fails', async () => {
    mocks.eval.mockRejectedValue(new Error('Redis unavailable'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await consumeUsage({
      userId: 'user-1',
      mode: 'adaptive',
      attemptId: 'attempt-2',
      now
    })

    expect(result.allowed).toBe(true)
    expect(result.enforced).toBe(false)
    expect(result.cost).toBe(2)
    errorSpy.mockRestore()
  })

  it('fails open when Redis times out', async () => {
    vi.useFakeTimers()
    mocks.eval.mockReturnValue(new Promise(() => {}))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const pending = consumeUsage({
      userId: 'user-1',
      mode: 'quick',
      attemptId: 'attempt-timeout',
      now
    })
    await vi.advanceTimersByTimeAsync(3000)
    const result = await pending

    expect(result.allowed).toBe(true)
    expect(result.enforced).toBe(false)
    expect(mocks.redisSignals).toHaveLength(1)
    expect(mocks.redisSignals[0].aborted).toBe(true)
    errorSpy.mockRestore()
  })

  it('refunds through one idempotent Lua evaluation', async () => {
    mocks.eval.mockResolvedValue([1, 0, 8, 4, 92, 2, 100, resetAt])

    const result = await refundUsage({
      userId: 'user-1',
      attemptId: 'attempt-3',
      now
    })

    expect(result).toMatchObject({
      refunded: true,
      duplicate: false,
      amount: 2,
      remaining: 92
    })
    expect(mocks.eval).toHaveBeenCalledTimes(1)
  })

  it('refunds the original stored period across a boundary', async () => {
    mocks.hgetall.mockResolvedValue({
      period_spend_key: 'ub:v2:p:user-1:original-period',
      hourly_spend_key: 'ub:v2:h:user-1:2026-09-30-23'
    })
    mocks.eval.mockResolvedValue([1, 0, 8, 4, 92, 2, 100, resetAt])

    await refundUsage({
      userId: 'user-1',
      attemptId: 'attempt-boundary',
      now: new Date('2026-10-01T00:00:01.000Z')
    })

    const [, keys] = mocks.eval.mock.calls[0]
    expect(keys).toEqual([
      'ub:v2:p:user-1:original-period',
      'ub:v2:h:user-1:2026-09-30-23',
      'ub:v2:a:user-1:attempt-boundary'
    ])
  })

  it('keeps all gate mutations and refund deduplication inside Lua', () => {
    expect(USAGE_GATE_SCRIPT).toContain("redis.call('HGETALL', KEYS[3])")
    expect(USAGE_GATE_SCRIPT).toContain("'period_spend_key', KEYS[1]")
    expect(USAGE_GATE_SCRIPT).toContain("redis.call('INCRBY'")
    expect(USAGE_GATE_SCRIPT).toContain("redis.call('EXPIRE'")
    expect(USAGE_REFUND_SCRIPT).toContain("'refunded', 1")
    expect(USAGE_REFUND_SCRIPT).toContain("redis.call('DECRBY'")
  })
})
