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
vi.mock('@/lib/db', () => {
  const db: Record<string, unknown> = {
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined)
    })),
    // Role lookup for the last-admin guard: no row -> guard skipped.
    select: vi.fn(() => ({
      from: vi.fn(() =>
        Object.assign(Promise.resolve([{ n: 0 }]), {
          where: vi.fn(() =>
            Object.assign(Promise.resolve([{ n: 0 }]), {
              limit: vi.fn(async () => []),
              for: vi.fn(async () => [])
            })
          )
        })
      )
    }))
  }
  // Transactions receive the same mock object so deletes through tx
  // are visible on db.delete.
  db.transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return { db }
})

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

  it('rolls back the identity deletion when cleanup fails', async () => {
    vi.mocked(dbActions.deleteUserChats).mockResolvedValue({
      success: false,
      error: 'db down'
    })

    const result = await deleteAccount()

    expect(result.success).toBe(false)
    expect(result.error).toBe('db down')
    // The identity delete shares the guard transaction, so the real
    // database rolls it back when a cleanup step fails (the mock
    // transaction has no rollback to show). The user keeps the account
    // and its sessions, and can retry the deletion.
    expect(trackAccountDeleted).not.toHaveBeenCalled()
  })

  it('serializes concurrent deletions in-process', async () => {
    // The guard transaction holds a pooled connection while cleanup
    // steps check out their own; unbounded concurrency could occupy the
    // whole pool. Deletions must run one at a time per process.
    let active = 0
    let maxActive = 0
    vi.mocked(dbActions.deleteUserChats).mockImplementation(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active--
      return { success: true }
    })

    await Promise.all([deleteAccount(), deleteAccount()])

    expect(maxActive).toBe(1)
  })

  it('refuses before destroying any data when the user is the only admin', async () => {
    vi.mocked(db.select).mockImplementation((() => ({
      from: () =>
        Object.assign(Promise.resolve([{ n: 2 }]), {
          where: () =>
            Object.assign(Promise.resolve([{ n: 1 }]), {
              limit: async () => [{ id: 'user-1', role: 'admin' }],
              for: async () => [{ id: 'user-1' }]
            })
        })
    })) as never)

    const result = await deleteAccount()

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/only admin/i)
    // The rejection must happen before the destructive steps: a rejected
    // deletion must leave the account's chats, notes, and files intact.
    expect(dbActions.deleteUserChats).not.toHaveBeenCalled()
    expect(dbActions.deleteUserNotes).not.toHaveBeenCalled()
    expect(dbActions.deleteUserLibraryFiles).not.toHaveBeenCalled()
    expect(deleteUserObjects).not.toHaveBeenCalled()
    expect(db.delete).not.toHaveBeenCalled()
  })

  it('returns an error result when the pre-check throws', async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error('db down')
    })

    const result = await deleteAccount()

    expect(result.success).toBe(false)
    expect(result.error).toBe('db down')
    expect(dbActions.deleteUserChats).not.toHaveBeenCalled()
  })
})
