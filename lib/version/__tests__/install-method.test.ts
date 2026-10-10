import { describe, expect, test } from 'vitest'

import { resolveInstallMethod } from '../install-method'

describe('resolveInstallMethod', () => {
  test.each([
    {
      name: 'explicit override is used verbatim',
      env: { MORPHIC_INSTALL_METHOD: 'unraid' },
      expected: 'unraid'
    },
    {
      name: 'explicit override wins over Vercel detection',
      env: { MORPHIC_INSTALL_METHOD: 'docker', VERCEL: '1' },
      expected: 'docker'
    },
    {
      name: 'Vercel detection when no override is set',
      env: { VERCEL: '1' },
      expected: 'vercel'
    },
    {
      name: 'empty override falls through to Vercel detection',
      env: { MORPHIC_INSTALL_METHOD: '', VERCEL: '1' },
      expected: 'vercel'
    },
    {
      name: 'defaults to source',
      env: {},
      expected: 'source'
    }
  ])('$name', ({ env, expected }) => {
    expect(resolveInstallMethod(env)).toBe(expected)
  })
})
