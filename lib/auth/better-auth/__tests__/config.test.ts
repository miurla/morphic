import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyBootstrapAdminHook } from '@/lib/auth/better-auth/config'
import { db } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn()
    }))
  }
}))

function mockUserCount(total: number) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockResolvedValue([{ total }])
  } as never)
}

describe('bootstrap admin hook', () => {
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

  it('grants admin to the first user when no gate is configured', async () => {
    mockUserCount(0)

    const result = await applyBootstrapAdminHook({ email: 'first@example.com' })

    expect(result).toEqual({
      data: { email: 'first@example.com', role: 'admin' }
    })
  })

  it('leaves later users untouched once the window closed', async () => {
    mockUserCount(1)

    const result = await applyBootstrapAdminHook({
      email: 'second@example.com'
    })

    expect(result).toBeUndefined()
  })

  it('rejects other emails while BOOTSTRAP_ADMIN_EMAIL is set', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com'
    mockUserCount(0)

    await expect(
      applyBootstrapAdminHook({ email: 'intruder@example.com' })
    ).rejects.toThrow(/BOOTSTRAP_ADMIN_EMAIL/)
  })

  it('accepts the gated email case-insensitively', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'Admin@Example.com'
    mockUserCount(0)

    const result = await applyBootstrapAdminHook({
      email: 'admin@example.com'
    })

    expect(result).toEqual({
      data: { email: 'admin@example.com', role: 'admin' }
    })
  })

  it('does not gate sign-ups after the window closed even with a gate set', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com'
    mockUserCount(3)

    const result = await applyBootstrapAdminHook({
      email: 'someone-else@example.com'
    })

    expect(result).toBeUndefined()
  })
})
