import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock next/navigation
const mockBack = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush
  })
}))

// Mock the overlay stack
const mockOverlayPop = vi.fn()
let mockOverlaySize = 0
vi.mock('../use-overlay-stack', () => ({
  useOverlayStack: () => ({
    push: vi.fn(),
    pop: mockOverlayPop,
    peek: vi.fn(() => null),
    get size() {
      return mockOverlaySize
    }
  })
}))

import { useBackButton } from '../use-back-button'

describe('useBackButton', () => {
  beforeEach(() => {
    mockOverlaySize = 0
    vi.stubGlobal('window', {
      ...window,
      history: { ...window.history, length: 3 }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('closes topmost overlay when overlays are open', () => {
    mockOverlaySize = 2
    const { result } = renderHook(() => useBackButton())

    result.current.handleBack()

    expect(mockOverlayPop).toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('calls router.back() when no overlay and history length > 1', () => {
    mockOverlaySize = 0
    const { result } = renderHook(() => useBackButton())

    result.current.handleBack()

    expect(mockBack).toHaveBeenCalled()
    expect(mockOverlayPop).not.toHaveBeenCalled()
  })

  it('navigates to root when history length is 1', () => {
    mockOverlaySize = 0
    vi.stubGlobal('window', {
      ...window,
      history: { ...window.history, length: 1 }
    })

    const { result } = renderHook(() => useBackButton())

    result.current.handleBack()

    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('calls custom onBack handler when provided and no overlays', () => {
    mockOverlaySize = 0
    const customHandler = vi.fn()
    const { result } = renderHook(() =>
      useBackButton({ onBack: customHandler })
    )

    result.current.handleBack()

    expect(customHandler).toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('prefers overlay close over custom handler', () => {
    mockOverlaySize = 1
    const customHandler = vi.fn()
    const { result } = renderHook(() =>
      useBackButton({ onBack: customHandler })
    )

    result.current.handleBack()

    expect(mockOverlayPop).toHaveBeenCalled()
    expect(customHandler).not.toHaveBeenCalled()
  })
})
