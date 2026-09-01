import { afterEach, describe, expect, it, vi } from 'vitest'

describe('database configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defers the missing connection string error until database access', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('DATABASE_RESTRICTED_URL', '')

    const databaseModule = await import('@/lib/db')

    expect(() => databaseModule.db.select).toThrow(
      'DATABASE_URL or DATABASE_RESTRICTED_URL environment variable is not set'
    )
  })

  it('falls back to DATABASE_URL when the restricted URL is empty', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/testdb')
    vi.stubEnv('DATABASE_RESTRICTED_URL', '')

    const databaseModule = await import('@/lib/db')

    expect(() => databaseModule.db.select).not.toThrow()
  })
})
