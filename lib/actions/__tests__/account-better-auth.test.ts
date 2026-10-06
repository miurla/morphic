import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { trackAccountDeleted } from '@/lib/analytics'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { db } from '@/lib/db'
import * as dbActions from '@/lib/db/actions'
import { deleteUserObjects } from '@/lib/storage/r2-client'

import { deleteAccount } from '../account'

vi.mock('@/lib/analytics')
vi.mock('@/lib/auth/get-current-user')
vi.mock('@/lib/db/actions')
vi.mock('@/lib/storage/r2-client')
vi.mock('@/lib/db', () => ({
  db: {
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined)
    }))
  }
}))

describe('deleteAccount with the better-auth provider', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ['AUTH_PROVIDER', 'MORPHIC_CLOUD_DEPLOYMENT']) {
      originalEnv[key] = process.env[key]
    }
    process.env.AUTH_PROVIDER = 'better-auth'
    delete process.env.MORPHIC_CLOUD_DEPLOYMENT

    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'user'
    })
    vi.mocked(dbActions.deleteUserChats).mockResolvedValue({ success: true })
    vi.mocked(dbActions.deleteUserNotes).mockResolvedValue({ success: true })
    vi.mocked(dbActions.deleteUserLibraryFiles).mockResolvedValue({
      success: true
    })
    vi.mocked(dbActions.anonymizeUserFeedback).mockResolvedValue({
      success: true
    })
    vi.mocked(deleteUserObjects).mockResolvedValue({ deletedCount: 0 } as never)
    vi.mocked(trackAccountDeleted).mockResolvedValue()
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    vi.clearAllMocks()
  })

  it('removes chats, notes, files, and the auth user record', async () => {
    const result = await deleteAccount()

    expect(result).toEqual({ success: true })
    expect(dbActions.deleteUserChats).toHaveBeenCalledWith('user-1')
    expect(dbActions.deleteUserNotes).toHaveBeenCalledWith('user-1')
    expect(dbActions.deleteUserLibraryFiles).toHaveBeenCalledWith('user-1')
    expect(dbActions.anonymizeUserFeedback).toHaveBeenCalledWith('user-1')
    expect(deleteUserObjects).toHaveBeenCalledWith('user-1')
    expect(db.delete).toHaveBeenCalled()
  })
})
