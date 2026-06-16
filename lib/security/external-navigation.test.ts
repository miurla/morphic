import { describe, expect, it } from 'vitest'

import {
  assessExternalNavigation,
  isSensitiveNavigation,
  shouldShowLeavingAppWarning
} from './external-navigation'

describe('external navigation assessment', () => {
  const baseOrigin = 'https://morphic.sh'

  it('treats same-origin links as safe', () => {
    const result = assessExternalNavigation('/search/123', baseOrigin)

    expect(result.risk).toBe('none')
    expect(result.isExternal).toBe(false)
  })

  it('flags external links', () => {
    const result = assessExternalNavigation('https://example.org', baseOrigin)

    expect(result.risk).toBe('external-origin')
    expect(result.displayHost).toBe('example.org')
  })

  it('flags sensitive authentication destinations', () => {
    const result = assessExternalNavigation(
      'https://accounts.example.org/login',
      baseOrigin
    )

    expect(result.risk).toBe('sensitive-external')
    expect(result.reason).toContain('credentials')
  })

  it('fails closed for malformed destinations', () => {
    const result = assessExternalNavigation('http://[invalid', baseOrigin)

    expect(result.risk).toBe('sensitive-external')
    expect(result.isValidUrl).toBe(false)
  })

  it('does not show web-origin warnings for non-http protocol handlers', () => {
    const protocols = [
      'mailto:hello@example.org',
      'tel:+15555555555',
      'sms:+15555555555'
    ]

    for (const href of protocols) {
      const result = assessExternalNavigation(href, baseOrigin)
      expect(result.risk).toBe('none')
      expect(result.displayHost).toBeNull()
    }
  })

  it('does not show a broken warning for javascript URLs', () => {
    const result = assessExternalNavigation('javascript:alert(1)', baseOrigin)

    expect(result.risk).toBe('none')
    expect(result.displayHost).toBeNull()
  })

  it('shows warnings for external destinations', () => {
    expect(shouldShowLeavingAppWarning('https://example.org', baseOrigin)).toBe(
      true
    )
  })
})

describe('sensitive navigation detection', () => {
  it('detects login flows', () => {
    expect(isSensitiveNavigation(new URL('https://example.org/login'))).toBe(
      true
    )
  })

  it('detects payment flows', () => {
    expect(
      isSensitiveNavigation(new URL('https://checkout.example.org/pay'))
    ).toBe(true)
  })

  it('allows normal content pages', () => {
    expect(
      isSensitiveNavigation(new URL('https://example.org/blog/post'))
    ).toBe(false)
  })
})
