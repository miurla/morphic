import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCaptureServerEvent = vi.hoisted(() => vi.fn())
const mockDeletePerson = vi.hoisted(() => vi.fn())

vi.mock('@/lib/analytics/providers/posthog-server', () => ({
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...args),
  deletePerson: (...args: unknown[]) => mockDeletePerson(...args)
}))

import {
  capture,
  deleteAnalyticsPerson,
  isAnalyticsEnabled
} from '@/lib/analytics/dispatch'

const original = process.env.MORPHIC_CLOUD_DEPLOYMENT

describe('analytics dispatch', () => {
  beforeEach(() => {
    mockCaptureServerEvent.mockReset().mockResolvedValue(undefined)
    mockDeletePerson.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env.MORPHIC_CLOUD_DEPLOYMENT = original
  })

  it('is a no-op outside cloud deployment', async () => {
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'false'

    expect(isAnalyticsEnabled()).toBe(false)
    await capture({ event: 'e', distinctId: 'u' })
    await deleteAnalyticsPerson('u')

    expect(mockCaptureServerEvent).not.toHaveBeenCalled()
    expect(mockDeletePerson).not.toHaveBeenCalled()
  })

  it('forwards to the provider in cloud deployment', async () => {
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'true'

    await capture({ event: 'e', distinctId: 'u', properties: { a: 1 } })
    await deleteAnalyticsPerson('u')

    expect(mockCaptureServerEvent).toHaveBeenCalledWith({
      event: 'e',
      distinctId: 'u',
      properties: { a: 1 }
    })
    expect(mockDeletePerson).toHaveBeenCalledWith('u')
  })

  it('never throws when the provider fails', async () => {
    process.env.MORPHIC_CLOUD_DEPLOYMENT = 'true'
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockCaptureServerEvent.mockRejectedValue(new Error('down'))

    await expect(
      capture({ event: 'e', distinctId: 'u' })
    ).resolves.toBeUndefined()
  })
})
