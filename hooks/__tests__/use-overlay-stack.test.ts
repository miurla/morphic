import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useOverlayStack } from '../use-overlay-stack'

describe('useOverlayStack', () => {
  let pushStateSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    pushStateSpy = vi.fn()
    vi.stubGlobal('window', {
      ...window,
      history: {
        ...window.history,
        pushState: pushStateSpy,
        back: vi.fn()
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts with empty stack', () => {
    const { result } = renderHook(() => useOverlayStack())
    expect(result.current.size).toBe(0)
    expect(result.current.peek()).toBeNull()
  })

  it('push adds entry and calls pushState', () => {
    const { result } = renderHook(() => useOverlayStack())
    const close = vi.fn()

    act(() => {
      result.current.push({ id: 'sheet-1', type: 'sheet', close })
    })

    expect(result.current.size).toBe(1)
    expect(result.current.peek()?.id).toBe('sheet-1')
    expect(pushStateSpy).toHaveBeenCalledWith(
      { __morphic_overlay__: 'sheet-1' },
      ''
    )
  })

  it('pop removes topmost entry and calls its close function', () => {
    const { result } = renderHook(() => useOverlayStack())
    const close1 = vi.fn()
    const close2 = vi.fn()

    act(() => {
      result.current.push({ id: 'panel-1', type: 'panel', close: close1 })
      result.current.push({ id: 'sheet-1', type: 'sheet', close: close2 })
    })

    expect(result.current.size).toBe(2)

    act(() => {
      result.current.pop()
    })

    expect(close2).toHaveBeenCalled()
    expect(close1).not.toHaveBeenCalled()
    expect(result.current.size).toBe(1)
    expect(result.current.peek()?.id).toBe('panel-1')
  })

  it('maintains LIFO ordering', () => {
    const { result } = renderHook(() => useOverlayStack())
    const close1 = vi.fn()
    const close2 = vi.fn()
    const close3 = vi.fn()

    act(() => {
      result.current.push({ id: 'a', type: 'panel', close: close1 })
      result.current.push({ id: 'b', type: 'sheet', close: close2 })
      result.current.push({ id: 'c', type: 'dialog', close: close3 })
    })

    act(() => result.current.pop())
    expect(close3).toHaveBeenCalled()

    act(() => result.current.pop())
    expect(close2).toHaveBeenCalled()

    act(() => result.current.pop())
    expect(close1).toHaveBeenCalled()

    expect(result.current.size).toBe(0)
  })

  it('pop is a no-op when stack is empty', () => {
    const { result } = renderHook(() => useOverlayStack())

    // Should not throw
    expect(() => {
      act(() => result.current.pop())
    }).not.toThrow()

    expect(result.current.size).toBe(0)
  })

  it('peek returns null when stack is empty', () => {
    const { result } = renderHook(() => useOverlayStack())
    expect(result.current.peek()).toBeNull()
  })
})
