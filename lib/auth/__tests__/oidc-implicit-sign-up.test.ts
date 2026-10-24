import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  resetAuthInstance,
  validateOidcUserCreation
} from '@/lib/auth/better-auth/config'

/**
 * The generic-OAuth/OIDC sign-up policy runs inside better-auth's
 * `user.validateUserInfo` seam, at user-creation time, against the live
 * user table:
 *
 * - invite/invalid sign-up mode blocks implicit account creation;
 * - open mode blocks it while the bootstrap window is open (empty user
 *   table — the first account needs the emailed bootstrap link, which
 *   proves mailbox ownership an OAuth callback cannot provide);
 * - open mode with existing accounts allows it;
 * - credential sign-ups (invitation/bootstrap policy) and an existing
 *   identity signing in or linking are not affected;
 * - an unreadable user table fails closed.
 */
const oauthCreateUserSource = {
  action: 'create-user',
  method: 'oauth',
  oauth: { providerId: 'oidc' }
}

function validate(
  source: NonNullable<Parameters<typeof validateOidcUserCreation>[0]>['source'],
  countUsers: () => Promise<number>
) {
  return validateOidcUserCreation({ source }, countUsers)
}

beforeEach(() => {
  resetAuthInstance()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('validateOidcUserCreation (sign-up mode)', () => {
  it('rejects implicit creation in invite mode', async () => {
    vi.stubEnv('AUTH_SIGNUP_MODE', 'invite')
    const result = await validate(oauthCreateUserSource, async () => 5)

    expect(result?.error).toBe('sign_up_not_allowed')
  })

  it('rejects implicit creation when AUTH_SIGNUP_MODE is invalid', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('AUTH_SIGNUP_MODE', 'invite-only')
    const result = await validate(oauthCreateUserSource, async () => 5)

    expect(result?.error).toBe('sign_up_unavailable')
    expect(warn).toHaveBeenCalled()
  })

  it('allows universal sign-up in open mode', async () => {
    vi.stubEnv('AUTH_SIGNUP_MODE', 'open')
    const result = await validate(oauthCreateUserSource, async () => 5)

    expect(result).toBeUndefined()
  })

  it('defaults to open mode when AUTH_SIGNUP_MODE is unset', async () => {
    const result = await validate(oauthCreateUserSource, async () => 5)

    expect(result).toBeUndefined()
  })
})

describe('validateOidcUserCreation (bootstrap window)', () => {
  it('rejects the first account through OAuth (empty user table)', async () => {
    vi.stubEnv('AUTH_SIGNUP_MODE', 'open')
    const result = await validate(oauthCreateUserSource, async () => 0)

    expect(result?.error).toBe('bootstrap_window_open')
  })

  it('allows implicit creation once an account exists', async () => {
    vi.stubEnv('AUTH_SIGNUP_MODE', 'open')
    const result = await validate(oauthCreateUserSource, async () => 1)

    expect(result).toBeUndefined()
  })

  it('fails closed when the user table cannot be read', async () => {
    vi.stubEnv('AUTH_SIGNUP_MODE', 'open')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await validate(oauthCreateUserSource, async () => {
      throw new Error('db unreachable')
    })

    expect(result?.error).toBe('sign_up_unavailable')
    expect(warn).toHaveBeenCalled()
  })
})

describe('validateOidcUserCreation (unrelated provisioning)', () => {
  it.each([
    // Credential sign-ups carry their own invitation/bootstrap policy.
    { action: 'create-user', method: 'email-password' },
    // An existing identity is never subject to the sign-up gate again.
    { action: 'sign-in', method: 'oauth', oauth: { providerId: 'oidc' } },
    { action: 'link-account', method: 'oauth', oauth: { providerId: 'oidc' } }
  ] as const)('does not gate %#', async sourceTest => {
    const result = await validate(
      sourceTest as typeof oauthCreateUserSource,
      async () => 0
    )

    expect(result).toBeUndefined()
  })

  it('does not gate a missing source', async () => {
    const result = await validateOidcUserCreation(
      { source: undefined },
      async () => 0
    )

    expect(result).toBeUndefined()
  })
})
