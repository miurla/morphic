import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyBootstrapAdminGate,
  claimBootstrapAdmin,
  getAuth,
  getSignUpMode,
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

function mockClaim(opts: {
  admins?: Array<{ id: string }>
  earliest?: string
}) {
  const set = vi.fn(() => ({ where: vi.fn() }))
  const update = vi.fn(() => ({ set }))
  const tx = {
    execute: vi.fn(),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(opts.admins ?? [])
        })),
        orderBy: vi.fn(() => ({
          limit: vi
            .fn()
            .mockResolvedValue(opts.earliest ? [{ id: opts.earliest }] : [])
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
  it('grants the admin role to the first account', async () => {
    const { tx, update, set } = mockClaim({ earliest: 'user-1' })

    await claimBootstrapAdmin('user-1')

    expect(tx.execute).toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith({ role: 'admin' })
  })

  it('does nothing when an admin already exists', async () => {
    const { update } = mockClaim({
      admins: [{ id: 'existing-admin' }],
      earliest: 'user-1'
    })

    await claimBootstrapAdmin('user-1')

    expect(update).not.toHaveBeenCalled()
  })

  it('does nothing when other users remain (no re-bootstrap after the first account)', async () => {
    // Sole admin deleted their account while members remained: the next
    // registrant is neither an admin nor the earliest account, so it must
    // not inherit the role.
    const { update } = mockClaim({ earliest: 'older-user' })

    await claimBootstrapAdmin('user-1')

    expect(update).not.toHaveBeenCalled()
  })

  it('elects exactly one admin when concurrent first sign-ups both observe each other', async () => {
    // Alice and Bob commit before either after-hook claims; each claim sees
    // both rows. Only the earliest account may claim, so exactly one wins
    // regardless of interleaving.
    const claims: string[] = []
    for (const userId of ['alice', 'bob']) {
      const { update } = mockClaim({ earliest: 'alice' })
      await claimBootstrapAdmin(userId)
      if (update.mock.calls.length > 0) {
        claims.push(userId)
      }
    }

    expect(claims).toEqual(['alice'])
  })

  it('silently accepts serialization failures from concurrent first sign-ups', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(db.transaction).mockRejectedValue(
      Object.assign(
        new Error('could not serialize access due to concurrent update'),
        {
          code: '40001'
        }
      )
    )

    await expect(claimBootstrapAdmin('user-1')).resolves.toBeUndefined()
    expect(errorSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('logs unexpected claim failures', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(db.transaction).mockRejectedValue(new Error('connection lost'))

    await expect(claimBootstrapAdmin('user-1')).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith(
      'Bootstrap admin claim failed:',
      expect.any(Error)
    )

    errorSpy.mockRestore()
  })
})

describe('getSignUpMode', () => {
  const original = process.env.AUTH_SIGNUP_MODE

  afterEach(() => {
    if (original === undefined) {
      delete process.env.AUTH_SIGNUP_MODE
    } else {
      process.env.AUTH_SIGNUP_MODE = original
    }
  })

  it('defaults to open when unset', () => {
    delete process.env.AUTH_SIGNUP_MODE
    expect(getSignUpMode()).toBe('open')
  })

  it('accepts open and invite (case-insensitive, trimmed)', () => {
    process.env.AUTH_SIGNUP_MODE = ' invite '
    expect(getSignUpMode()).toBe('invite')
    process.env.AUTH_SIGNUP_MODE = 'Open'
    expect(getSignUpMode()).toBe('open')
  })

  it('throws on an unsupported value instead of silently opening sign-ups', () => {
    process.env.AUTH_SIGNUP_MODE = 'invte'
    expect(() => getSignUpMode()).toThrow(/Invalid AUTH_SIGNUP_MODE/)
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
