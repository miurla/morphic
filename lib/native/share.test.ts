import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetRuntimeCache } from './runtime'
import { canShare, nativeShare } from './share'

beforeEach(() => {
  _resetRuntimeCache()
})

afterEach(() => {
  _resetRuntimeCache()
  vi.unstubAllGlobals()
})

describe('share — canShare', () => {
  it('returns false during SSR', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('navigator', undefined)
    expect(canShare()).toBe(false)
  })

  it('returns true when Web Share API is available', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', {
      share: vi.fn()
    })
    expect(canShare()).toBe(true)
  })

  it('returns true when clipboard is available as fallback', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn() }
    })
    expect(canShare()).toBe(true)
  })

  it('returns false when no sharing mechanism exists', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', {})
    expect(canShare()).toBe(false)
  })
})

describe('share — nativeShare', () => {
  it('returns { shared: false, method: "none" } during SSR', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('navigator', undefined)

    const result = await nativeShare({
      title: 'Test',
      url: 'https://example.com'
    })
    expect(result.shared).toBe(false)
    expect(result.method).toBe('none')
  })

  it('uses Web Share API when available', async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', {
      share: shareFn,
      standalone: false
    })

    const result = await nativeShare({
      title: 'Hello',
      url: 'https://morphic.sh'
    })
    expect(result.shared).toBe(true)
    expect(result.method).toBe('web-share')
    expect(shareFn).toHaveBeenCalledWith({
      title: 'Hello',
      text: undefined,
      url: 'https://morphic.sh'
    })
  })

  it('handles user cancellation (AbortError) gracefully', async () => {
    const abortError = new Error('user cancelled')
    abortError.name = 'AbortError'
    const shareFn = vi.fn().mockRejectedValue(abortError)

    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', {
      share: shareFn,
      standalone: false
    })

    const result = await nativeShare({ title: 'Test' })
    expect(result.shared).toBe(false)
    expect(result.method).toBe('web-share')
  })

  it('falls back to clipboard when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
      standalone: false
    })

    const result = await nativeShare({
      title: 'Title',
      text: 'Body',
      url: 'https://x.com'
    })
    expect(result.shared).toBe(true)
    expect(result.method).toBe('clipboard')
    expect(writeText).toHaveBeenCalledWith('Title\nBody\nhttps://x.com')
  })

  it('returns none when all methods fail', async () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', { standalone: false })

    const result = await nativeShare({ url: 'https://test.com' })
    expect(result.shared).toBe(false)
    expect(result.method).toBe('none')
  })
})
