import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({
  set: vi.fn(),
  eval: vi.fn(),
  on: vi.fn(),
  isOpen: true
}))
vi.mock('redis', () => ({ createClient: () => client }))

import { withAssessmentLock } from '../assessment-lock'

describe('assessment concurrency', () => {
  beforeEach(() => {
    vi.stubEnv('TUTOR_REDIS_URL', 'redis://localhost:16380')
    vi.clearAllMocks()
    client.set.mockResolvedValue('OK')
    client.eval.mockResolvedValue(1)
  })
  it('does not evaluate a duplicate concurrent answer', async () => {
    client.set.mockResolvedValue(null)
    const assess = vi.fn()
    await expect(
      withAssessmentLock('user', 'question', assess)
    ).rejects.toMatchObject({ code: 'ASSESSMENT_IN_PROGRESS' })
    expect(assess).not.toHaveBeenCalled()
    expect(client.eval).not.toHaveBeenCalled()
  })
  it('releases its own lease after evaluation failures', async () => {
    await expect(
      withAssessmentLock('user', 'question', async () => {
        throw new Error('provider failed')
      })
    ).rejects.toThrow('provider failed')
    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining('ARGV[1]'),
      {
        keys: [expect.stringContaining('tutor:assessment:')],
        arguments: [expect.any(String)]
      }
    )
  })
  it('scopes the lock to the learner and returns the assessment', async () => {
    await expect(
      withAssessmentLock('user-a', 'same-question', async () => 75)
    ).resolves.toBe(75)
    await withAssessmentLock('user-b', 'same-question', async () => 50)
    expect(client.set.mock.calls[0][0]).not.toBe(client.set.mock.calls[1][0])
  })
})
