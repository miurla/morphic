import { beforeEach, describe, expect, it, vi } from 'vitest'

import { withRLS } from '@/lib/db/with-rls'

import { getAttachmentSizesByObjectKey } from '../actions'

vi.mock('@/lib/db/with-rls', () => ({
  withOptionalRLS: vi.fn(),
  withRLS: vi.fn()
}))

describe('getAttachmentSizesByObjectKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not query for an empty key list', async () => {
    const result = await getAttachmentSizesByObjectKey({
      userId: 'user-1',
      objectKeys: []
    })

    expect(result).toEqual(new Map())
    expect(withRLS).not.toHaveBeenCalled()
  })

  it('maps results by object key and skips null sizes', async () => {
    const where = vi.fn().mockResolvedValue([
      { objectKey: 'files/a.pdf', size: 1234 },
      { objectKey: 'files/missing.pdf', size: null },
      { objectKey: 'files/b.pdf', size: 5678 }
    ])
    const from = vi.fn().mockReturnValue({ where })
    const select = vi.fn().mockReturnValue({ from })

    vi.mocked(withRLS).mockImplementation(async (_userId, callback) =>
      callback({ select } as never)
    )

    const result = await getAttachmentSizesByObjectKey({
      userId: 'user-1',
      objectKeys: ['files/a.pdf', 'files/missing.pdf', 'files/b.pdf']
    })

    expect(result).toEqual(
      new Map([
        ['files/a.pdf', 1234],
        ['files/b.pdf', 5678]
      ])
    )
    expect(select).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledTimes(1)
    expect(where).toHaveBeenCalledTimes(1)
  })
})
