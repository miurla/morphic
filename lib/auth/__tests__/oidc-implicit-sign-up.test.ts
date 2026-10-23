import { describe, expect, it } from 'vitest'

import { isOidcImplicitSignUpBlocked } from '@/lib/auth/better-auth/config'

/**
 * The gate has two lifetimes that must behave independently:
 *
 * - the permanent one: sign-up mode (invite/invalid blocks always, and the
 *   block must never lift with an account event), and
 * - the bootstrap window: with SMTP + BOOTSTRAP_ADMIN_EMAIL and open mode,
 *   the first account requires mailbox proof through the emailed bootstrap
 *   link — an OAuth callback cannot prove ownership — so implicit OIDC
 *   sign-up stays blocked while the window is open, and the state measured
 *   after the first account closes the window (and all cases in between).
 */
describe('isOidcImplicitSignUpBlocked', () => {
  const base = {
    signUpModeAllowsImplicit: true,
    smtpConfigured: false,
    bootstrapAddressConfigured: false,
    userTableEmpty: null
  }

  it('blocks advance-of-measurement when the user table state is unknown', () => {
    // The window cannot be ruled out yet: err on the safe side, and let the
    // one-shot calibration or the first sign-up settle the state.
    const gate = isOidcImplicitSignUpBlocked({
      ...base,
      smtpConfigured: true,
      bootstrapAddressConfigured: true
    })
    expect(gate.blocked).toBe(true)
    expect(gate.liftsWithFirstAccount).toBe(true)
  })

  it('keeps the gate while the bootstrap window is open (table still empty)', () => {
    const gate = isOidcImplicitSignUpBlocked({
      ...base,
      smtpConfigured: true,
      bootstrapAddressConfigured: true,
      userTableEmpty: true
    })
    expect(gate.blocked).toBe(true)
    expect(gate.liftsWithFirstAccount).toBe(true)
  })

  it('lifts the gate once an account closed the bootstrap window', () => {
    // The regression both reviewers flagged: the gate used to test only
    // env vars and never cleared after the first account existed.
    const gate = isOidcImplicitSignUpBlocked({
      ...base,
      smtpConfigured: true,
      bootstrapAddressConfigured: true,
      userTableEmpty: false
    })
    expect(gate.blocked).toBe(false)
    expect(gate.liftsWithFirstAccount).toBe(false)
  })

  it('does not gate at all without SMTP or without a bootstrap address', () => {
    for (const env of [
      { smtpConfigured: false, bootstrapAddressConfigured: false },
      { smtpConfigured: true, bootstrapAddressConfigured: false },
      { smtpConfigured: false, bootstrapAddressConfigured: true }
    ]) {
      const gate = isOidcImplicitSignUpBlocked({
        ...base,
        ...env,
        userTableEmpty: true
      })
      expect(gate.blocked).toBe(false)
      expect(gate.liftsWithFirstAccount).toBe(false)
    }
  })

  it('blocks permanently in invite-only mode, regardless of the window', () => {
    for (const userTableEmpty of [null, true, false] as const) {
      const gate = isOidcImplicitSignUpBlocked({
        ...base,
        signUpModeAllowsImplicit: false,
        smtpConfigured: true,
        bootstrapAddressConfigured: true,
        userTableEmpty
      })
      expect(gate.blocked).toBe(true)
      // A first-account event must never widen an invite-only instance.
      expect(gate.liftsWithFirstAccount).toBe(false)
    }
  })

  it('allows implicit sign-up in open mode without the window env', () => {
    const gate = isOidcImplicitSignUpBlocked({ ...base, userTableEmpty: false })
    expect(gate.blocked).toBe(false)
    expect(gate.liftsWithFirstAccount).toBe(false)
  })
})
