import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  inserted: [] as Array<Record<string, unknown>>,
  activeRows: [] as Array<{
    amount: number
    idempotencyKey: string
    kind: 'period' | 'adjustment'
    expiresAt: Date
  }>,
  getCurrentUser: vi.fn(),
  trackSyncFailed: vi.fn()
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: mocks.getCurrentUser
}))

vi.mock('../analytics', () => ({
  trackUsageGrantSyncFailed: mocks.trackSyncFailed
}))

vi.mock('@/lib/db/with-rls', () => ({
  withRLS: vi.fn(
    async (
      _userId: string,
      callback: (transaction: unknown) => Promise<unknown>
    ) => {
      const transaction = {
        insert: vi.fn(() => ({
          values: vi.fn((value: Record<string, unknown>) => {
            mocks.inserted.push(value)
            return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }
          })
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(mocks.activeRows)
          }))
        }))
      }
      return callback(transaction)
    }
  )
}))

import { syncUsageGrants, UsageAnchorUnavailableError } from '../grants'

describe('usage grant synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.inserted.length = 0
    mocks.activeRows.length = 0
  })

  it('issues only the current anniversary grant', async () => {
    const now = new Date('2026-09-20T13:00:00.000Z')
    const anchor = new Date('2025-01-31T12:00:00.000Z')
    const periodStart = new Date('2026-09-30T12:00:00.000Z')
    // September 20 is before this month's clamped anniversary, so the active
    // period began on August 31.
    const actualStart = new Date('2026-08-31T12:00:00.000Z')
    const periodEnd = periodStart
    const idempotencyKey = `period:${actualStart.getTime()}`
    mocks.activeRows.push({
      amount: 100,
      idempotencyKey,
      kind: 'period',
      expiresAt: periodEnd
    })

    const grants = await syncUsageGrants({
      userId: 'user-1',
      userCreatedAt: anchor,
      now
    })

    expect(mocks.inserted).toHaveLength(1)
    expect(mocks.inserted[0]).toMatchObject({
      idempotencyKey,
      kind: 'period',
      amount: 100,
      grantedAt: actualStart,
      expiresAt: periodEnd
    })
    expect(grants).toEqual({
      monthly: 100,
      monthlyExpiresAt: periodEnd
    })
  })

  it('excludes adjustments until their lifecycle is implemented', async () => {
    const now = new Date('2026-09-20T13:00:00.000Z')
    const anchor = new Date('2026-01-20T12:00:00.000Z')
    const currentKey = `period:${Date.parse('2026-09-20T12:00:00.000Z')}`
    const expiresAt = new Date('2026-10-20T12:00:00.000Z')
    mocks.activeRows.push(
      {
        amount: 100,
        idempotencyKey: currentKey,
        kind: 'period',
        expiresAt
      },
      {
        amount: 50,
        idempotencyKey: 'adjust:future-lifecycle',
        kind: 'adjustment',
        expiresAt
      }
    )

    const grants = await syncUsageGrants({
      userId: 'user-1',
      userCreatedAt: anchor,
      now
    })

    expect(grants.monthly).toBe(100)
    expect(mocks.inserted).toHaveLength(1)
  })

  it('fails without inventing an anchor when created_at is unavailable', async () => {
    await expect(
      syncUsageGrants({
        userId: 'user-1',
        userCreatedAt: null,
        now: new Date('2026-09-20T00:00:00.000Z')
      })
    ).rejects.toBeInstanceOf(UsageAnchorUnavailableError)

    expect(mocks.inserted).toHaveLength(0)
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
    expect(mocks.trackSyncFailed).toHaveBeenCalledWith(
      expect.objectContaining({ grantKind: 'period' })
    )
  })

  it('fails for a future trusted created_at', async () => {
    await expect(
      syncUsageGrants({
        userId: 'user-1',
        userCreatedAt: new Date('2026-09-21T00:00:00.000Z'),
        now: new Date('2026-09-20T00:00:00.000Z')
      })
    ).rejects.toBeInstanceOf(UsageAnchorUnavailableError)
  })
})
