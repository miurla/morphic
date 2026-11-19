import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as dbActions from '@/lib/db/actions'
import type { Space } from '@/lib/db/schema'

import { getChatSpaceForViewer } from '../chat-space'

vi.mock('@/lib/db/actions')

const space: Space = {
  id: 'space-1',
  userId: 'owner',
  color: 'green',
  name: 'Blog',
  about: 'Writing articles',
  style: 'Short paragraphs',
  createdAt: new Date('2026-11-13T00:00:00Z'),
  updatedAt: new Date('2026-11-13T00:00:00Z')
}

describe('getChatSpaceForViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dbActions.getSpaceById).mockResolvedValue(space)
  })

  it('treats a chat without a space as the default space', async () => {
    await expect(
      getChatSpaceForViewer({ userId: 'owner', spaceId: null }, 'owner')
    ).resolves.toBeNull()
    expect(dbActions.getSpaceById).not.toHaveBeenCalled()
  })

  it('gives the owner the color and name', async () => {
    await expect(
      getChatSpaceForViewer({ userId: 'owner', spaceId: 'space-1' }, 'owner')
    ).resolves.toEqual({ color: 'green', name: 'Blog' })
    expect(dbActions.getSpaceById).toHaveBeenCalledWith('owner', 'space-1')
  })

  it('gives other viewers only the color', async () => {
    await expect(
      getChatSpaceForViewer({ userId: 'owner', spaceId: 'space-1' }, 'viewer')
    ).resolves.toEqual({ color: 'green' })
    await expect(
      getChatSpaceForViewer({ userId: 'owner', spaceId: 'space-1' })
    ).resolves.toEqual({ color: 'green' })
  })

  it('falls back to the default space when the space is gone', async () => {
    vi.mocked(dbActions.getSpaceById).mockResolvedValue(null)
    await expect(
      getChatSpaceForViewer({ userId: 'owner', spaceId: 'space-1' }, 'owner')
    ).resolves.toBeNull()
  })

  it('falls back to the default space when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(dbActions.getSpaceById).mockRejectedValue(new Error('db'))
    await expect(
      getChatSpaceForViewer({ userId: 'owner', spaceId: 'space-1' }, 'owner')
    ).resolves.toBeNull()
  })
})
