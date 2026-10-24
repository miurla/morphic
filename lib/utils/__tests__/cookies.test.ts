import { afterEach, describe, expect, it, vi } from 'vitest'

import { getCookie } from '../cookies'

describe('getCookie', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('preserves equals signs in a cookie value', () => {
    vi.stubGlobal('document', { cookie: 'token=abc==; searchMode=quick' })

    expect(getCookie('token')).toBe('abc==')
    expect(getCookie('searchMode')).toBe('quick')
    expect(getCookie('missing')).toBeNull()
  })
})
