// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ready: vi.fn(),
  remove: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  options: vi.fn(),
  getJob: vi.fn(),
  add: vi.fn()
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
    getJob = mocks.getJob
    add = mocks.add
  }
}))

import {
  enqueueDocumentParse,
  getDocumentParseState,
  removeCourseJobs
} from '../queue'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('TUTOR_REDIS_URL', 'redis://localhost:16380')
  mocks.ready.mockResolvedValue(undefined)
  mocks.remove.mockResolvedValue(1)
  mocks.disconnect.mockResolvedValue(undefined)
  mocks.getJob.mockResolvedValue(null)
  mocks.add.mockResolvedValue({ id: 'parse-d' })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('document preparation queue', () => {
  it('exposes a terminal job only for its owning document and user', async () => {
    mocks.getJob.mockResolvedValue({
      name: 'parse',
      data: { userId: 'u', documentId: 'd' },
      getState: async () => 'failed'
    })
    expect(await getDocumentParseState({ userId: 'u', documentId: 'd' })).toBe(
      'failed'
    )
    expect(
      await getDocumentParseState({ userId: 'other', documentId: 'd' })
    ).toBe('missing')
    expect(
      await getDocumentParseState({ userId: 'u', documentId: 'other' })
    ).toBe('missing')
    mocks.getJob.mockResolvedValue(null)
    expect(await getDocumentParseState({ userId: 'u', documentId: 'd' })).toBe(
      'missing'
    )
  })
  it('uses a stable document job ID and one attempt for invalid files', async () => {
    await enqueueDocumentParse({ userId: 'u', documentId: 'd' })
    expect(mocks.add).toHaveBeenCalledWith(
      'parse',
      { userId: 'u', documentId: 'd' },
      { jobId: 'parse-d', attempts: 1 }
    )
  })
  it('reuses active jobs and explicitly retries failed jobs', async () => {
    const retry = vi.fn()
    mocks.getJob.mockResolvedValue({
      id: 'parse-d',
      getState: async () => 'active',
      retry
    })
    await enqueueDocumentParse({ userId: 'u', documentId: 'd' })
    expect(mocks.add).not.toHaveBeenCalled()
    expect(retry).not.toHaveBeenCalled()
    mocks.getJob.mockResolvedValue({
      id: 'parse-d',
      getState: async () => 'failed',
      retry
    })
    await enqueueDocumentParse({ userId: 'u', documentId: 'd' })
    expect(retry).toHaveBeenCalledOnce()
  })
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
