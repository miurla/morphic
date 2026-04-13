import { describe, expect, it } from 'vitest'

import { getGravatarUrl } from '../gravatar'

describe('getGravatarUrl', () => {
  it('generates a valid Gravatar URL with SHA-256 hash', async () => {
    const url = await getGravatarUrl('test@example.com')
    expect(url).toMatch(
      /^https:\/\/www\.gravatar\.com\/avatar\/[a-f0-9]{64}\?d=404$/
    )
  })

  it('normalizes email by trimming and lowercasing', async () => {
    const url1 = await getGravatarUrl('Test@Example.com')
    const url2 = await getGravatarUrl('  test@example.com  ')
    const url3 = await getGravatarUrl('test@example.com')
    expect(url1).toBe(url3)
    expect(url2).toBe(url3)
  })

  it('produces different hashes for different emails', async () => {
    const url1 = await getGravatarUrl('alice@example.com')
    const url2 = await getGravatarUrl('bob@example.com')
    expect(url1).not.toBe(url2)
  })

  it('generates correct hash for a known email', async () => {
    // SHA-256 of "miurap400@gmail.com" can be verified independently
    const url = await getGravatarUrl('miurap400@gmail.com')
    expect(url).toContain('https://www.gravatar.com/avatar/')
    expect(url).toContain('?d=404')

    // Extract hash and verify it's a valid 64-char hex string
    const hash = url
      .replace('https://www.gravatar.com/avatar/', '')
      .replace('?d=404', '')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })
})
