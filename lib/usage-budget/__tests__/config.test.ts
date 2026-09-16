import { afterEach, describe, expect, it, vi } from 'vitest'

describe('usage budget config', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('uses the phase-one defaults', async () => {
    delete process.env.USAGE_COST_QUICK
    delete process.env.USAGE_COST_ADAPTIVE
    delete process.env.MONTHLY_USAGE_ALLOWANCE
    delete process.env.HOURLY_USAGE_GUARD

    const config = await import('../config')

    expect(config.USAGE_COST).toEqual({ quick: 1, adaptive: 2 })
    expect(config.MONTHLY_ALLOWANCE).toBe(100)
    expect(config.HOURLY_GUARD).toBe(30)
  })

  it('accepts positive integer overrides and rejects invalid values', async () => {
    process.env.USAGE_COST_QUICK = '3'
    process.env.USAGE_COST_ADAPTIVE = '2.5'
    process.env.MONTHLY_USAGE_ALLOWANCE = '-1'
    process.env.HOURLY_USAGE_GUARD = 'not-a-number'

    const config = await import('../config')

    expect(config.USAGE_COST).toEqual({ quick: 3, adaptive: 2 })
    expect(config.MONTHLY_ALLOWANCE).toBe(100)
    expect(config.HOURLY_GUARD).toBe(30)
  })
})
