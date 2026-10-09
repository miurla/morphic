import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyBootstrapAdminGate,
  claimBootstrapAdmin,
  getAuth,
  resetAuthInstance
} from '@/lib/auth/better-auth/config'
import { db } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn()
    })),
    transaction: vi.fn()
  }
}))

function mockUserCount(total: number) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockResolvedValue([{ total }])
  } as never)
}

function mockClaim(admins: Array<{ id: string }>) {
  const set = vi.fn(() => ({ where: vi.fn() }))
  const update = vi.fn(() => ({ set }))
  const tx = {
    execute: vi.fn(),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(admins)
        }))
      }))
    })),
    update
  }
  vi.mocked(db.transaction).mockImplementation(
    async callback => (callback as (tx: unknown) => Promise<void>)(tx) as never
  )
  return { tx, update, set }
}

describe('bootstrap admin gate', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ['BOOTSTRAP_ADMIN_EMAIL', 'NODE_ENV']) {
      originalEnv[key] = process.env[key]
    }
    delete process.env.BOOTSTRAP_ADMIN_EMAIL
    vi.clearAllMocks()
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('allows any email through while no gate is configured', async () => {
    mockUserCount(0)

    await expect(
      applyBootstrapAdminGate({ email: 'first@example.com' })
    ).resolves.toBeUndefined()
  })

  it('leaves later sign-ups untouched once the window closed', async () => {
    mockUserCount(1)

    await expect(
      applyBootstrapAdminGate({ email: 'second@example.com' })
    ).resolves.toBeUndefined()
  })

  it('rejects other emails while BOOTSTRAP_ADMIN_EMAIL is set', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com'
    mockUserCount(0)

    await expect(
      applyBootstrapAdminGate({ email: 'intruder@example.com' })
    ).rejects.toThrow(/BOOTSTRAP_ADMIN_EMAIL/)
  })

  it('accepts the gated email case-insensitively', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'Admin@Example.com'
    mockUserCount(0)

    await expect(
      applyBootstrapAdminGate({ email: 'admin@example.com' })
    ).resolves.toBeUndefined()
  })

  it('does not gate sign-ups after the window closed even with a gate set', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com'
    mockUserCount(3)

    await expect(
      applyBootstrapAdminGate({ email: 'someone-else@example.com' })
    ).resolves.toBeUndefined()
  })
})

describe('claimBootstrapAdmin', () => {
  it('grants the admin role when no admin exists yet', async () => {
    const { tx, update, set } = mockClaim([])

    await claimBootstrapAdmin('user-1')

    expect(tx.execute).toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith({ role: 'admin' })
  })

  it('does nothing when an admin already exists', async () => {
    const { update } = mockClaim([{ id: 'existing-admin' }])

    await claimBootstrapAdmin('user-1')

    expect(update).not.toHaveBeenCalled()
  })

  it('swallows serialization failures from concurrent first sign-ups', async () => {
    vi.mocked(db.transaction).mockRejectedValue(
      new Error('could not serialize access due to concurrent update')
    )

    await expect(claimBootstrapAdmin('user-1')).resolves.toBeUndefined()
  })
})

describe('auth secret', () => {
  beforeEach(() => {
    resetAuthInstance()
  })

  afterEach(() => {
    resetAuthInstance()
    vi.unstubAllEnvs()
  })

  it('throws in production when BETTER_AUTH_SECRET is missing', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('BETTER_AUTH_SECRET', undefined)

    expect(() => getAuth()).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('uses the configured secret in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('BETTER_AUTH_SECRET', 'a'.repeat(32))

    expect(() => getAuth()).not.toThrow()
  })

  it('falls back to the development secret outside production', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('BETTER_AUTH_SECRET', undefined)

    expect(() => getAuth()).not.toThrow()
  })
})
