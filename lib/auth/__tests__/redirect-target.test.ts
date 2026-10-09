import { describe, expect, it } from 'vitest'

import { safeRedirectPath } from '@/lib/auth/redirect-target'

describe('safeRedirectPath', () => {
  it('keeps plain same-origin paths', () => {
    expect(safeRedirectPath('/search/abc123')).toBe('/search/abc123')
    expect(safeRedirectPath('/search/abc?x=1#top')).toBe('/search/abc?x=1#top')
  })

  it('falls back to the root when absent', () => {
    expect(safeRedirectPath(undefined)).toBe('/')
    expect(safeRedirectPath('')).toBe('/')
  })

  it('rejects protocol-relative and absolute destinations', () => {
    expect(safeRedirectPath('//evil.example.com')).toBe('/')
    expect(safeRedirectPath('http://evil.example.com')).toBe('/')
    expect(safeRedirectPath('https://evil.example.com/path')).toBe('/')
  })

  it('rejects backslash-normalized destinations', () => {
    // Browsers normalize backslashes to slashes when resolving URLs, so
    // /\evil.example.com would navigate off-site after navigation.
    expect(safeRedirectPath('/\\evil.example.com')).toBe('/')
  })

  it('rejects non-HTTP schemes and credentials', () => {
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/')
    expect(safeRedirectPath('http://user:pass@redirect-target.invalid/')).toBe(
      '/'
    )
  })
})
