import { describe, expect, it } from 'vitest'

import { faviconUrl, normalizeFaviconDomain } from '../favicon'

describe('normalizeFaviconDomain', () => {
  it('accepts a full URL and a bare host alike', () => {
    expect(normalizeFaviconDomain('https://www.example.com/a?b=c')).toBe(
      'www.example.com'
    )
    expect(normalizeFaviconDomain('example.com')).toBe('example.com')
    expect(normalizeFaviconDomain('  Example.COM  ')).toBe('example.com')
  })

  it('refuses IP literals so a render cannot probe an address', () => {
    expect(normalizeFaviconDomain('127.0.0.1')).toBeNull()
    expect(normalizeFaviconDomain('http://169.254.169.254/latest')).toBeNull()
    expect(normalizeFaviconDomain('[::1]')).toBeNull()
    expect(normalizeFaviconDomain('http://[::1]')).toBeNull()
  })

  it('refuses names that are not public hostnames', () => {
    expect(normalizeFaviconDomain('')).toBeNull()
    expect(normalizeFaviconDomain('localhost')).toBeNull()
    expect(normalizeFaviconDomain('javascript:alert(1)')).toBeNull()
    expect(normalizeFaviconDomain('file:///etc/passwd')).toBeNull()
    expect(normalizeFaviconDomain('exa mple.com')).toBeNull()
    expect(normalizeFaviconDomain(`${'a'.repeat(300)}.com`)).toBeNull()
  })

  it('drops credentials and ports that the lookup does not use', () => {
    expect(normalizeFaviconDomain('https://user:pw@example.com:8443')).toBe(
      'example.com'
    )
  })
})

describe('faviconUrl', () => {
  it('points at our own origin', () => {
    expect(faviconUrl('https://example.com/page')).toBe(
      '/api/favicon?domain=example.com&sz=16'
    )
    expect(faviconUrl('example.com', 128)).toBe(
      '/api/favicon?domain=example.com&sz=128'
    )
  })

  it('returns an empty string the caller can skip rendering on', () => {
    expect(faviconUrl('not a host')).toBe('')
  })

  it('escapes the domain it puts in the query', () => {
    expect(faviconUrl('https://example.com/?x=1#y')).toBe(
      '/api/favicon?domain=example.com&sz=16'
    )
  })
})
