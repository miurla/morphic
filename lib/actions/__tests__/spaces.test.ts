import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import type { Space } from '@/lib/db/schema'

import { deleteSpace, listSpaces, saveSpace } from '../spaces'

vi.mock('@/lib/auth/get-current-user')
vi.mock('@/lib/db/actions')

const space: Space = {
  id: 'space-1',
  userId: 'user-1',
  color: 'green',
  name: 'Blog',
  about: 'Writing articles',
  style: 'Short paragraphs',
  createdAt: new Date('2026-11-13T00:00:00Z'),
  updatedAt: new Date('2026-11-13T00:00:00Z')
}

describe('Space actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    vi.mocked(dbActions.getSpaces).mockResolvedValue([space])
    vi.mocked(dbActions.upsertSpace).mockResolvedValue(space)
    vi.mocked(dbActions.deleteSpace).mockResolvedValue({ success: true })
  })

  describe('listSpaces', () => {
    it('lists the current user spaces', async () => {
      await expect(listSpaces()).resolves.toEqual({
        success: true,
        spaces: [space]
      })
      expect(dbActions.getSpaces).toHaveBeenCalledWith('user-1')
    })

    it('requires a user', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValue(undefined as any)

      const result = await listSpaces()

      expect(result.success).toBe(false)
      expect(result.spaces).toEqual([])
      expect(dbActions.getSpaces).not.toHaveBeenCalled()
    })
  })

  describe('saveSpace', () => {
    it('upserts the space for the color with only the given fields', async () => {
      const result = await saveSpace({ color: 'green', about: 'Writing' })

      expect(result).toEqual({ success: true, space })
      expect(dbActions.upsertSpace).toHaveBeenCalledWith({
        userId: 'user-1',
        color: 'green',
        name: undefined,
        about: 'Writing',
        style: undefined
      })
    })

    it('keeps the default space name fixed', async () => {
      await saveSpace({ color: 'black', name: 'Mine', style: 'Be brief' })

      expect(dbActions.upsertSpace).toHaveBeenCalledWith({
        userId: 'user-1',
        color: 'black',
        name: 'Default',
        about: undefined,
        style: 'Be brief'
      })
    })

    it('rejects an unknown color', async () => {
      const result = await saveSpace({ color: 'teal', about: 'x' })

      expect(result.success).toBe(false)
      expect(dbActions.upsertSpace).not.toHaveBeenCalled()
    })

    it.each([
      ['name', { name: 'a'.repeat(31) }],
      ['about', { about: 'a'.repeat(4001) }],
      ['style', { style: 'a'.repeat(4001) }]
    ])('rejects a %s over the limit', async (_, fields) => {
      const result = await saveSpace({ color: 'green', ...fields })

      expect(result.success).toBe(false)
      expect(dbActions.upsertSpace).not.toHaveBeenCalled()
    })

    it('accepts fields at the limit', async () => {
      const result = await saveSpace({
        color: 'green',
        name: 'a'.repeat(30),
        about: 'a'.repeat(4000),
        style: 'a'.repeat(4000)
      })

      expect(result.success).toBe(true)
    })

    it('rejects non-text fields', async () => {
      const result = await saveSpace({ color: 'green', about: 42 as any })

      expect(result.success).toBe(false)
      expect(dbActions.upsertSpace).not.toHaveBeenCalled()
    })

    it('requires a user', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValue(undefined as any)

      const result = await saveSpace({ color: 'green', about: 'x' })

      expect(result.success).toBe(false)
      expect(dbActions.upsertSpace).not.toHaveBeenCalled()
    })

    it('reports a failed write', async () => {
      vi.mocked(dbActions.upsertSpace).mockRejectedValue(new Error('db down'))
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await saveSpace({ color: 'green', about: 'x' })

      expect(result).toEqual({ success: false, error: 'Failed to save space.' })
    })
  })

  describe('deleteSpace', () => {
    it('deletes the space for the color', async () => {
      await expect(deleteSpace('green')).resolves.toEqual({ success: true })
      expect(dbActions.deleteSpace).toHaveBeenCalledWith('user-1', 'green')
    })

    it('refuses to delete the default space', async () => {
      const result = await deleteSpace('black')

      expect(result.success).toBe(false)
      expect(dbActions.deleteSpace).not.toHaveBeenCalled()
    })

    it('rejects an unknown color', async () => {
      const result = await deleteSpace('teal')

      expect(result.success).toBe(false)
      expect(dbActions.deleteSpace).not.toHaveBeenCalled()
    })

    it('requires a user', async () => {
      vi.mocked(getCurrentUserId).mockResolvedValue(undefined as any)

      const result = await deleteSpace('green')

      expect(result.success).toBe(false)
      expect(dbActions.deleteSpace).not.toHaveBeenCalled()
    })
  })
})
