import { describe, expect, it } from 'vitest'

import { displayUrlName } from '../domain'

describe('displayUrlName', () => {
  it('extracts domain name from standard URL', () => {
    expect(displayUrlName('https://www.google.com')).toBe('google')
    expect(displayUrlName('https://www.example.org')).toBe('example')
    expect(displayUrlName('https://www.github.io')).toBe('github')
  })

  it('handles subdomains correctly', () => {
    expect(displayUrlName('https://docs.github.com')).toBe('github')
    expect(displayUrlName('https://api.example.org')).toBe('example')
    expect(displayUrlName('https://en.wikipedia.org')).toBe('wikipedia')
  })

  it('handles URLs without subdomain', () => {
    expect(displayUrlName('https://example.com')).toBe('example')
    expect(displayUrlName('https://github.io')).toBe('github')
  })

  it('handles localhost and simple hostnames', () => {
    expect(displayUrlName('http://localhost')).toBe('localhost')
    expect(displayUrlName('http://localhost:3000')).toBe('localhost')
  })

  it('handles complex subdomains', () => {
    expect(displayUrlName('https://sub.domain.example.com')).toBe(
      'domain.example'
    )
  })

  it('returns fallback for invalid URLs', () => {
    expect(displayUrlName('not-a-url')).toBe('source')
    expect(displayUrlName('')).toBe('source')
    expect(displayUrlName('://invalid')).toBe('source')
  })

  it('handles URLs with paths and query parameters', () => {
    expect(displayUrlName('https://www.google.com/search?q=test')).toBe(
      'google'
    )
    expect(displayUrlName('https://docs.github.com/en/get-started')).toBe(
      'github'
    )
  })

  it('handles different protocols', () => {
    expect(displayUrlName('http://www.example.com')).toBe('example')
    expect(displayUrlName('https://www.example.com')).toBe('example')
    expect(displayUrlName('ftp://ftp.example.com')).toBe('example')
  })

  it('handles real-world news domains', () => {
    expect(displayUrlName('https://www.bbc.com/news')).toBe('bbc')
    expect(displayUrlName('https://www.cnn.com/world')).toBe('cnn')
    expect(displayUrlName('https://techcrunch.com/article')).toBe('techcrunch')
  })

  it('handles stack overflow and similar domains', () => {
    expect(displayUrlName('https://stackoverflow.com/questions/123')).toBe(
      'stackoverflow'
    )
    expect(displayUrlName('https://meta.stackoverflow.com')).toBe(
      'stackoverflow'
    )
  })
})
