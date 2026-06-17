import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock next/navigation
const mockPathname = vi.fn(() => '/')
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname()
}))

import { useScrollRestoration } from '../use-scroll-restoration'

describe('useScrollRestoration', () => {
  let mockContainer: any

  beforeEach(() => {
    mockContainer = {
      scrollTop: 0,
      scrollHeight: 2000,
      clientHeight: 800,
      scrollTo: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns scrollOffset and scrollToTop', () => {
    const ref = { current: mockContainer }
    const { result } = renderHook(() =>
      useScrollRestoration({ containerRef: ref })
    )

    expect(result.current.scrollOffset).toBe(0)
    expect(typeof result.current.scrollToTop).toBe('function')
  })

  it('scrollToTop calls scrollTo with top 0', () => {
    const ref = { current: mockContainer }
    const { result } = renderHook(() =>
      useScrollRestoration({ containerRef: ref })
    )

    result.current.scrollToTop()

    expect(mockContainer.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth'
    })
  })

  it('resets scroll to top on forward navigation', () => {
    mockPathname.mockReturnValue('/page-a')
    const ref = { current: mockContainer }

    renderHook(() => useScrollRestoration({ containerRef: ref }))

    // Forward navigation should reset to 0
    expect(mockContainer.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('registers scroll listener on container', () => {
    const ref = { current: mockContainer }
    renderHook(() => useScrollRestoration({ containerRef: ref }))

    expect(mockContainer.addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { passive: true }
    )
  })

  it('cleans up scroll listener on unmount', () => {
    const ref = { current: mockContainer }
    const { unmount } = renderHook(() =>
      useScrollRestoration({ containerRef: ref })
    )

    unmount()

    expect(mockContainer.removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function)
    )
  })

  it('handles null containerRef gracefully', () => {
    const ref = { current: null }

    expect(() => {
      renderHook(() => useScrollRestoration({ containerRef: ref }))
    }).not.toThrow()
  })
})
