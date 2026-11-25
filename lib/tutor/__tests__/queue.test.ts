// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ready: vi.fn(),
  remove: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  options: vi.fn()
}))

vi.mock('bullmq', () => ({
  Queue: class {
    constructor(name: string, options: unknown) {
      mocks.options(name, options)
    }
    waitUntilReady = mocks.ready
    remove = mocks.remove
    disconnect = mocks.disconnect
    on = mocks.on
  }
}))

import { removeCourseJobs } from '../queue'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('TUTOR_REDIS_URL', 'redis://localhost:16380')
  mocks.ready.mockResolvedValue(undefined)
  mocks.remove.mockResolvedValue(1)
  mocks.disconnect.mockResolvedValue(undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('deleted Tutor course job cleanup', () => {
  it('removes course and distinct chapter jobs and releases its own connection', async () => {
    await removeCourseJobs({ courseId: 'c', chapterIds: ['a', 'b', 'a'] })
    expect(mocks.remove.mock.calls).toEqual([
      ['course-c'],
      ['chapter-a'],
      ['chapter-b']
    ])
    expect(mocks.disconnect).toHaveBeenCalledOnce()
    expect(mocks.options).toHaveBeenCalledWith(
      'morphic-tutor',
      expect.objectContaining({
        connection: expect.objectContaining({
          connectTimeout: 1000,
          commandTimeout: 1000,
          maxRetriesPerRequest: 0
        })
      })
    )
  })

  it('tolerates locked or missing jobs and still attempts every chapter', async () => {
    mocks.remove
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce(new Error('locked'))
    await expect(
      removeCourseJobs({ courseId: 'c', chapterIds: ['a', 'b'] })
    ).resolves.toBeUndefined()
    expect(mocks.remove).toHaveBeenCalledTimes(3)
    expect(mocks.disconnect).toHaveBeenCalledOnce()
  })

  it('does not fail a completed database deletion when Redis is unavailable', async () => {
    mocks.ready.mockRejectedValue(new Error('redis://secret@example'))
    await expect(
      removeCourseJobs({ courseId: 'c', chapterIds: [] })
    ).resolves.toBeUndefined()
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.disconnect).toHaveBeenCalledOnce()
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
      'secret'
    )
  })

  it('returns within two seconds even when Redis never becomes ready', async () => {
    vi.useFakeTimers()
    mocks.ready.mockReturnValue(new Promise(() => {}))
    const cleanup = removeCourseJobs({ courseId: 'c', chapterIds: [] })
    await vi.advanceTimersByTimeAsync(2000)
    await expect(cleanup).resolves.toBeUndefined()
    expect(mocks.disconnect).toHaveBeenCalledOnce()
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('also bounds a removal command that never completes', async () => {
    vi.useFakeTimers()
    mocks.remove.mockReturnValue(new Promise(() => {}))
    const cleanup = removeCourseJobs({ courseId: 'c', chapterIds: ['a'] })
    await vi.advanceTimersByTimeAsync(2000)
    await expect(cleanup).resolves.toBeUndefined()
    expect(mocks.disconnect).toHaveBeenCalledOnce()
  })
})
