import { describe, expect, it } from 'vitest'

import {
  ADAPTIVE_MODE_AUTH_REQUIRED_MESSAGE,
  isAdaptiveModeAuthBlocked,
  requiresAdaptiveModeAuth
} from '@/lib/search-mode-availability'

describe('search mode availability', () => {
  it('requires auth for adaptive mode only for cloud guests', () => {
    expect(
      requiresAdaptiveModeAuth({
        isGuest: true,
        isCloudDeployment: true
      })
    ).toBe(true)
    expect(
      requiresAdaptiveModeAuth({
        isGuest: false,
        isCloudDeployment: true
      })
    ).toBe(false)
    expect(
      requiresAdaptiveModeAuth({
        isGuest: true,
        isCloudDeployment: false
      })
    ).toBe(false)
  })

  it('blocks adaptive mode sends for cloud guests', () => {
    expect(
      isAdaptiveModeAuthBlocked({
        mode: 'adaptive',
        isGuest: true,
        isCloudDeployment: true
      })
    ).toBe(true)
    expect(
      isAdaptiveModeAuthBlocked({
        mode: 'quick',
        isGuest: true,
        isCloudDeployment: true
      })
    ).toBe(false)
  })

  it('uses the intentional auth message', () => {
    expect(ADAPTIVE_MODE_AUTH_REQUIRED_MESSAGE).toContain(
      'Sign in to use Adaptive mode'
    )
  })
})
