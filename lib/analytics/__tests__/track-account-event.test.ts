import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockTrack = vi.hoisted(() => vi.fn())

vi.mock('@vercel/analytics/server', () => ({
  track: (...args: unknown[]) => mockTrack(...args)
}))

import { trackAccountDeleted } from '@/lib/analytics/track-account-event'

const originalCloudDeployment = process.env.MORPHIC_CLOUD_DEPLOYMENT

describe('trackAccountDeleted', () => {
  beforeEach(() => {
    mockTrack.mockReset()
    mockTrack.mockResolvedValue(undefined)
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'true'
  })

  afterEach(() => {
    process.env.MORPHIC_CLOUD_DEPLOYMENT = originalCloudDeployment
  })

  it('tracks an anonymous account deletion event in cloud deployment', async () => {
    await trackAccountDeleted()

    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith('account_deleted')
  })

  it('does not track outside cloud deployment', async () => {
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'false'

    await trackAccountDeleted()

    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('does not throw when analytics tracking fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mockTrack.mockRejectedValue(new Error('Analytics unavailable'))

    await expect(trackAccountDeleted()).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to track account deletion event:',
      expect.any(Error)
    )

    consoleError.mockRestore()
  })
})
