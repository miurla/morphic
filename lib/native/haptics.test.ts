import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetRuntimeCache } from './runtime'

// Must reset runtime cache before each test so detection uses fresh globals
beforeEach(() => {
  _resetRuntimeCache()
})

afterEach(() => {
  _resetRuntimeCache()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('haptics — web fallback', () => {
  it('calls navigator.vibrate with short duration for light haptic', async () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({
        matches: query.includes('reduce') ? false : false
      })
    })
    vi.stubGlobal('navigator', { vibrate })

    const { hapticLight } = await import('./haptics')
    hapticLight()

    // Allow async tick to resolve
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('calls navigator.vibrate with longer duration for heavy haptic', async () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', { vibrate })

    const { hapticHeavy } = await import('./haptics')
    hapticHeavy()

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(vibrate).toHaveBeenCalledWith(40)
  })

  it('no-ops silently when navigator.vibrate is unavailable', async () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    vi.stubGlobal('navigator', {})

    const { hapticMedium } = await import('./haptics')

    // Should not throw
    expect(() => hapticMedium()).not.toThrow()
  })

  it('respects prefers-reduced-motion by not vibrating', async () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({
        matches: query.includes('prefers-reduced-motion')
      })
    })
    vi.stubGlobal('navigator', { vibrate })

    const { hapticLight } = await import('./haptics')
    hapticLight()

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(vibrate).not.toHaveBeenCalled()
  })

  it('no-ops during SSR when window is undefined', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('navigator', undefined)

    const { hapticLight } = await import('./haptics')

    expect(() => hapticLight()).not.toThrow()
  })
})
