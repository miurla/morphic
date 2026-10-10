import { describe, expect, test, vi } from 'vitest'

import { parseVersionCheckConfig } from '../config'

describe('parseVersionCheckConfig', () => {
  test.each([
    {
      name: 'defaults when nothing is set',
      env: {},
      expected: {
        repo: 'miurla/morphic',
        ttlSeconds: 86400,
        disabled: false
      }
    },
    {
      name: 'repo override',
      env: { MORPHIC_UPDATE_CHECK_REPO: 'acme/morphic' },
      expected: {
        repo: 'acme/morphic',
        ttlSeconds: 86400,
        disabled: false
      }
    },
    {
      name: 'ttl override',
      env: { MORPHIC_UPDATE_CHECK_TTL_SECONDS: '3600' },
      expected: {
        repo: 'miurla/morphic',
        ttlSeconds: 3600,
        disabled: false
      }
    },
    {
      name: 'ttl below floor clamps to 300',
      env: { MORPHIC_UPDATE_CHECK_TTL_SECONDS: '10' },
      expected: {
        repo: 'miurla/morphic',
        ttlSeconds: 300,
        disabled: false
      }
    },
    {
      name: 'ttl at the floor stays at 300',
      env: { MORPHIC_UPDATE_CHECK_TTL_SECONDS: '300' },
      expected: {
        repo: 'miurla/morphic',
        ttlSeconds: 300,
        disabled: false
      }
    },
    {
      name: 'non-numeric ttl falls back to the default',
      env: { MORPHIC_UPDATE_CHECK_TTL_SECONDS: 'banana' },
      expected: {
        repo: 'miurla/morphic',
        ttlSeconds: 86400,
        disabled: false
      }
    },
    {
      name: 'empty ttl falls back to the default',
      env: { MORPHIC_UPDATE_CHECK_TTL_SECONDS: '' },
      expected: {
        repo: 'miurla/morphic',
        ttlSeconds: 86400,
        disabled: false
      }
    },
    {
      name: 'fractional ttl is truncated',
      env: { MORPHIC_UPDATE_CHECK_TTL_SECONDS: '3600.9' },
      expected: {
        repo: 'miurla/morphic',
        ttlSeconds: 3600,
        disabled: false
      }
    },
    {
      name: 'disabled flag',
      env: { MORPHIC_UPDATE_CHECK_DISABLED: 'true' },
      expected: {
        repo: 'miurla/morphic',
        ttlSeconds: 86400,
        disabled: true
      }
    },
    {
      name: 'disabled only matches the literal true',
      env: { MORPHIC_UPDATE_CHECK_DISABLED: 'yes' },
      expected: {
        repo: 'miurla/morphic',
        ttlSeconds: 86400,
        disabled: false
      }
    }
  ])('$name', ({ env, expected }) => {
    expect(parseVersionCheckConfig(env)).toEqual(expected)
  })

  test('valid repo variants pass through', () => {
    expect(
      parseVersionCheckConfig({
        MORPHIC_UPDATE_CHECK_REPO: 'acme-foundation/morphic.rs'
      }).repo
    ).toBe('acme-foundation/morphic.rs')
  })

  test('invalid repo values fall back to the default with a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const invalid = [
      'https://github.com/acme/morphic',
      'acme/morphic/',
      'acme/morphic/extra',
      'not a repo',
      'acme'
    ]
    for (const repo of invalid) {
      expect(
        parseVersionCheckConfig({ MORPHIC_UPDATE_CHECK_REPO: repo }).repo
      ).toBe('miurla/morphic')
    }
    expect(warnSpy).toHaveBeenCalledTimes(invalid.length)

    warnSpy.mockRestore()
  })
})
