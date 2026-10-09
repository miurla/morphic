import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyBootstrapAdminGate,
  claimBootstrapAdmin,
  getAuth,
  getSignUpMode,
  isBootstrapAccount,
  isBootstrapWindowOpen,
  reElectBootstrapAdmin,
  resetAuthInstance
} from '@/lib/auth/better-auth/config'
import { sendSmtpMail } from '@/lib/auth/better-auth/mailer'
import { db } from '@/lib/db'

vi.mock('@/lib/auth/better-auth/mailer', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth/better-auth/mailer')>()),
  sendSmtpMail: vi.fn()
}))

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

  it('retries serialization failures and completes the claim when no admin materialized', async () => {
    // A 40001 abort does not prove a concurrent claimant committed:
    // both claimants can abort. The retry must re-run the election
    // instead of giving up and stranding the instance admin-less.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { update } = mockClaim({ earliest: 'user-1' })
    vi.mocked(db.transaction).mockRejectedValueOnce(
      Object.assign(new Error('could not serialize access'), {
        code: '40001'
      })
    )

    await expect(claimBootstrapAdmin('user-1')).resolves.toBeUndefined()

    expect(update).toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('logs unexpected claim failures', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(db.transaction).mockRejectedValue(new Error('connection lost'))

    await expect(claimBootstrapAdmin('user-1')).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap admin claim failed'),
      expect.any(Error)
    )
    // Exhaustion must read as a repair-needed condition with the
    // remediation, not a silent success.
    expect(errorSpy.mock.calls[0][0]).toContain('repair needed')
    expect(errorSpy.mock.calls[0][0]).toContain("SET role = 'admin'")

    errorSpy.mockRestore()
  })

  it('retries a transient claim failure until it succeeds', async () => {
    // The user insert is already committed at this point and the
    // earliest-account guard means no later sign-up can take the claim
    // over, so a transient blip must be retried rather than logged away.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { update } = mockClaim({ earliest: 'user-1' })
    vi.mocked(db.transaction).mockRejectedValueOnce(
      Object.assign(new Error('connection lost'), { code: '08006' })
    )

    await expect(claimBootstrapAdmin('user-1')).resolves.toBeUndefined()

    expect(update).toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})

describe('reElectBootstrapAdmin', () => {
  it('promotes the earliest account when the deletion left no admin', async () => {
    // A sign-up raced the sole admin's deletion: its own claim declined
    // because the admin row still existed. The re-election completes the
    // election for the earliest remaining account.
    const { update, set } = mockClaim({ earliest: 'raced-signup' })

    await reElectBootstrapAdmin()

    expect(update).toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith({ role: 'admin' })
  })

  it('does nothing when an admin exists', async () => {
    const { update } = mockClaim({
      admins: [{ id: 'existing-admin' }],
      earliest: 'user-1'
    })

    await reElectBootstrapAdmin()

    expect(update).not.toHaveBeenCalled()
  })

  it('does nothing on an empty table', async () => {
    const { update } = mockClaim({})

    await reElectBootstrapAdmin()

    expect(update).not.toHaveBeenCalled()
  })

  it('retries serialization failures and logs after exhausting attempts', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { update } = mockClaim({ earliest: 'raced-signup' })
    vi.mocked(db.transaction).mockRejectedValueOnce(
      Object.assign(new Error('could not serialize'), { code: '40001' })
    )
    await expect(reElectBootstrapAdmin()).resolves.toBeUndefined()
    expect(update).toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()

    vi.mocked(db.transaction).mockRejectedValue(new Error('boom'))
    await expect(reElectBootstrapAdmin()).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap admin re-election failed'),
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

describe('isBootstrapAccount', () => {
  const original = process.env.BOOTSTRAP_ADMIN_EMAIL

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BOOTSTRAP_ADMIN_EMAIL
    } else {
      process.env.BOOTSTRAP_ADMIN_EMAIL = original
    }
  })

  it('is false when no gate is configured', async () => {
    delete process.env.BOOTSTRAP_ADMIN_EMAIL
    mockUserCount(0)
    await expect(isBootstrapAccount('anyone@example.com')).resolves.toBe(false)
  })

  it('accepts the gated address while the table is empty', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
    mockUserCount(0)
    await expect(isBootstrapAccount('admin@corp.local')).resolves.toBe(true)
  })

  it('matches the gate case-insensitively and trimmed', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = ' Admin@Corp.local '
    mockUserCount(0)
    await expect(isBootstrapAccount('ADMIN@CORP.LOCAL')).resolves.toBe(true)
  })

  it('rejects other addresses', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
    mockUserCount(0)
    await expect(isBootstrapAccount('intruder@example.com')).resolves.toBe(
      false
    )
  })

  it('is false once the bootstrap window closed', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
    mockUserCount(1)
    await expect(isBootstrapAccount('admin@corp.local')).resolves.toBe(false)
  })
})

describe('isBootstrapWindowOpen', () => {
  const original = process.env.BOOTSTRAP_ADMIN_EMAIL

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BOOTSTRAP_ADMIN_EMAIL
    } else {
      process.env.BOOTSTRAP_ADMIN_EMAIL = original
    }
  })

  it('is false when no gate is configured', async () => {
    delete process.env.BOOTSTRAP_ADMIN_EMAIL
    mockUserCount(0)
    await expect(isBootstrapWindowOpen()).resolves.toBe(false)
  })

  it('is true while the gate is set and the table is empty', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
    mockUserCount(0)
    await expect(isBootstrapWindowOpen()).resolves.toBe(true)
  })

  it('is false once the first account exists', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@corp.local'
    mockUserCount(1)
    await expect(isBootstrapWindowOpen()).resolves.toBe(false)
  })
})

describe('reset password mailer wiring', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    resetAuthInstance()
    for (const key of [
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'BETTER_AUTH_URL'
    ]) {
      original[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    resetAuthInstance()
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('wires the reset mailer through the shared SMTP transport', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_USER = 'user'
    process.env.SMTP_PASSWORD = 'pass'

    const auth = getAuth()

    expect(typeof auth.options.emailAndPassword?.sendResetPassword).toBe(
      'function'
    )
  })

  it('omits the reset mailer when SMTP is not configured', () => {
    const auth = getAuth()

    expect(auth.options.emailAndPassword?.sendResetPassword).toBeUndefined()
  })

  it('refuses to send a reset email without a canonical origin', async () => {
    // Without BETTER_AUTH_URL the link could only be built from
    // caller-controlled headers: the mailer must fail instead of
    // delivering a live credential to a spoofed host.
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_USER = 'user'
    process.env.SMTP_PASSWORD = 'pass'

    const auth = getAuth()
    const sendResetPassword = auth.options.emailAndPassword?.sendResetPassword
    expect(sendResetPassword).toBeDefined()

    await expect(
      sendResetPassword!({
        user: { email: 'admin@corp.local' },
        url: 'http://localhost:3000/api/auth/reset-password/tok',
        token: 'tok'
      } as never)
    ).rejects.toThrow('BETTER_AUTH_URL')
    expect(sendSmtpMail).not.toHaveBeenCalled()
  })

  it('links the in-app reset page instead of better-auth unmounted endpoint', async () => {
    // better-auth's own /api/auth/reset-password/:token handler is not
    // mounted, so its generated url would 404; the email must carry the
    // raw token to the in-app page instead.
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_USER = 'user'
    process.env.SMTP_PASSWORD = 'pass'
    process.env.BETTER_AUTH_URL = 'http://localhost:3000/'

    const auth = getAuth()
    const sendResetPassword = auth.options.emailAndPassword?.sendResetPassword
    expect(sendResetPassword).toBeDefined()

    await sendResetPassword!({
      user: { email: 'admin@corp.local' },
      url: 'http://localhost:3000/api/auth/reset-password/tok?callbackURL=x',
      token: 'tok'
    } as never)

    expect(sendSmtpMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@corp.local',
        text: expect.stringContaining(
          'http://localhost:3000/auth/update-password?token=tok'
        )
      })
    )
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
