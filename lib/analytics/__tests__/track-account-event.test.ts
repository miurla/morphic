import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCapture = vi.hoisted(() => vi.fn())
const mockDeletePerson = vi.hoisted(() => vi.fn())

vi.mock('@/lib/analytics/dispatch', () => ({
  capture: (...args: unknown[]) => mockCapture(...args),
  deleteAnalyticsPerson: (...args: unknown[]) => mockDeletePerson(...args)
}))

import { trackAccountDeleted } from '@/lib/analytics/track-account-event'

describe('trackAccountDeleted', () => {
  beforeEach(() => {
    mockCapture.mockReset().mockResolvedValue(undefined)
    mockDeletePerson.mockReset().mockResolvedValue(undefined)
  })

  it('captures an anonymous deletion event and deletes the person', async () => {
    await trackAccountDeleted('user-123')

    expect(mockCapture).toHaveBeenCalledTimes(1)
    expect(mockCapture).toHaveBeenCalledWith({
      event: 'account_deleted',
      distinctId: 'account-lifecycle'
    })
    expect(mockDeletePerson).toHaveBeenCalledWith('user-123')
  })
})
