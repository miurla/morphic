import { afterEach, describe, expect, it, vi } from 'vitest'

import { getOidcProviderId } from '../oauth-config'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getOidcProviderId', () => {
  it('defaults to "oidc"', () => {
    expect(getOidcProviderId()).toBe('oidc')
  })

  it('reads and trims OIDC_PROVIDER_ID', () => {
    vi.stubEnv('OIDC_PROVIDER_ID', '  corporate-idp  ')
    expect(getOidcProviderId()).toBe('corporate-idp')
  })

  it('accepts every character the callback path allows', () => {
    vi.stubEnv('OIDC_PROVIDER_ID', 'corp.Id-1:$ok')
    expect(getOidcProviderId()).toBe('corp.Id-1:$ok')
  })

  it('rejects characters outside the callback charset', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('OIDC_PROVIDER_ID', 'corp/idp')

    expect(() => getOidcProviderId()).toThrow(/Invalid OIDC_PROVIDER_ID/)
    expect(warn).not.toHaveBeenCalled()
  })

  it('rejects ids over 128 characters', () => {
    vi.stubEnv('OIDC_PROVIDER_ID', 'a'.repeat(129))

    expect(() => getOidcProviderId()).toThrow(/Invalid OIDC_PROVIDER_ID/)
  })
})
