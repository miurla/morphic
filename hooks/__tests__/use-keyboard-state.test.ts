import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useKeyboardState } from '../use-keyboard-state'

describe('useKeyboardState', () => {
  let mockVisualViewport: any

  beforeEach(() => {
    mockVisualViewport = {
      height: 800,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    vi.stubGlobal('window', {
      ...window,
      innerHeight: 800,
      visualViewport: mockVisualViewport,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns isOpen: false when keyboard is not visible', () => {
    const { result } = renderHook(() => useKeyboardState())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.height).toBe(0)
  })

  it('reports isOpen: true when visualViewport shrinks past threshold', () => {
    const { result } = renderHook(() => useKeyboardState())

    // Simulate keyboard opening by shrinking viewport
    const resizeHandler = mockVisualViewport.addEventListener.mock.calls[0]?.[1]
    if (resizeHandler) {
      mockVisualViewport.height = 500 // shrunk by 300px > 150 threshold
      act(() => resizeHandler())
    }

    expect(result.current.isOpen).toBe(true)
    expect(result.current.height).toBe(300)
  })

  it('reports isOpen: false when viewport returns to original height', () => {
    const { result } = renderHook(() => useKeyboardState())

    const resizeHandler = mockVisualViewport.addEventListener.mock.calls[0]?.[1]
    if (resizeHandler) {
      // Open keyboard
      mockVisualViewport.height = 500
      act(() => resizeHandler())
      expect(result.current.isOpen).toBe(true)

      // Close keyboard
      mockVisualViewport.height = 800
      act(() => resizeHandler())
      expect(result.current.isOpen).toBe(false)
      expect(result.current.height).toBe(0)
    }
  })

  it('does not report keyboard open for small viewport changes (below threshold)', () => {
    const { result } = renderHook(() => useKeyboardState())

    const resizeHandler = mockVisualViewport.addEventListener.mock.calls[0]?.[1]
    if (resizeHandler) {
      // Small shrink (browser chrome, address bar) — should NOT trigger
      mockVisualViewport.height = 720 // only 80px, below 150 threshold
      act(() => resizeHandler())
    }

    expect(result.current.isOpen).toBe(false)
  })

  it('falls back to window.resize when visualViewport is unavailable', () => {
    const addListener = vi.fn()
    const removeListener = vi.fn()

    vi.stubGlobal('window', {
      ...window,
      innerHeight: 800,
      visualViewport: null,
      addEventListener: addListener,
      removeEventListener: removeListener
    })

    renderHook(() => useKeyboardState())

    expect(addListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('cleans up listeners on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardState())
    unmount()

    expect(mockVisualViewport.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    )
  })
})
