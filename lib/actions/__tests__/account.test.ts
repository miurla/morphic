import { revalidateTag } from 'next/cache'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { trackAccountDeleted } from '@/lib/analytics'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import { deleteUserObjects } from '@/lib/storage/r2-client'
import { createAdminClient } from '@/lib/supabase/admin'

import { deleteAccount } from '../account'

vi.mock('@/lib/analytics')
vi.mock('@/lib/auth/get-current-user')
vi.mock('@/lib/db/actions')
vi.mock('@/lib/storage/r2-client')
vi.mock('@/lib/supabase/admin')

const originalEnableAuth = process.env.ENABLE_AUTH

describe('Account Actions', () => {
  const user = { id: '550e8400-e29b-41d4-a716-446655440000' }
  const deleteUser = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENABLE_AUTH = 'true'

    vi.mocked(getCurrentUser).mockResolvedValue(user as any)
    vi.mocked(dbActions.deleteUserChats).mockResolvedValue({ success: true })
    vi.mocked(dbActions.anonymizeUserFeedback).mockResolvedValue({
      success: true
    })
    vi.mocked(deleteUserObjects).mockResolvedValue({
      deletedCount: 0,
      skipped: true
    })
    vi.mocked(trackAccountDeleted).mockResolvedValue()
    deleteUser.mockResolvedValue({ data: { user: null }, error: null })
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { deleteUser } }
    } as any)
  })

  afterEach(() => {
    process.env.ENABLE_AUTH = originalEnableAuth
  })

  it('returns an error in anonymous mode', async () => {
    process.env.ENABLE_AUTH = 'false'

    const result = await deleteAccount()

    expect(result).toEqual({
      success: false,
      error: 'Account deletion is unavailable in anonymous mode.'
    })
    expect(getCurrentUser).not.toHaveBeenCalled()
    expect(dbActions.deleteUserChats).not.toHaveBeenCalled()
  })

  it('returns an error when the user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const result = await deleteAccount()

    expect(result).toEqual({
      success: false,
      error: 'User not authenticated'
    })
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(dbActions.deleteUserChats).not.toHaveBeenCalled()
  })

  it('returns an error when Supabase admin is not configured', async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error('Missing secret key')
    })

    const result = await deleteAccount()

    expect(result).toEqual({
      success: false,
      error: 'Account deletion is not configured. Set SUPABASE_SECRET_KEY.'
    })
    expect(dbActions.deleteUserChats).not.toHaveBeenCalled()
  })

  it('deletes app data, anonymizes feedback, uploaded files, and auth user', async () => {
    const result = await deleteAccount()

    expect(result).toEqual({ success: true })
    expect(dbActions.deleteUserChats).toHaveBeenCalledWith(user.id)
    expect(dbActions.anonymizeUserFeedback).toHaveBeenCalledWith(user.id)
    expect(deleteUserObjects).toHaveBeenCalledWith(user.id)
    expect(deleteUser).toHaveBeenCalledWith(user.id)
    expect(revalidateTag).toHaveBeenCalledWith('chat', 'max')
    expect(trackAccountDeleted).toHaveBeenCalledTimes(1)
  })

  it('stops before storage and auth deletion when app data deletion fails', async () => {
    vi.mocked(dbActions.deleteUserChats).mockResolvedValue({
      success: false,
      error: 'Failed to delete user chats'
    })

    const result = await deleteAccount()

    expect(result).toEqual({
      success: false,
      error: 'Failed to delete user chats'
    })
    expect(deleteUserObjects).not.toHaveBeenCalled()
    expect(deleteUser).not.toHaveBeenCalled()
    expect(trackAccountDeleted).not.toHaveBeenCalled()
  })

  it('stops before storage and auth deletion when feedback anonymization fails', async () => {
    vi.mocked(dbActions.anonymizeUserFeedback).mockResolvedValue({
      success: false,
      error: 'Failed to anonymize user feedback'
    })

    const result = await deleteAccount()

    expect(result).toEqual({
      success: false,
      error: 'Failed to anonymize user feedback'
    })
    expect(deleteUserObjects).not.toHaveBeenCalled()
    expect(deleteUser).not.toHaveBeenCalled()
    expect(trackAccountDeleted).not.toHaveBeenCalled()
  })

  it('stops before auth deletion when uploaded file deletion fails', async () => {
    vi.mocked(deleteUserObjects).mockRejectedValue(new Error('Storage error'))

    const result = await deleteAccount()

    expect(result).toEqual({
      success: false,
      error: 'Storage error'
    })
    expect(dbActions.deleteUserChats).toHaveBeenCalledWith(user.id)
    expect(deleteUser).not.toHaveBeenCalled()
    expect(trackAccountDeleted).not.toHaveBeenCalled()
  })

  it('does not track account deletion when auth deletion fails', async () => {
    deleteUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Auth deletion failed')
    })

    const result = await deleteAccount()

    expect(result).toEqual({
      success: false,
      error: 'Auth deletion failed'
    })
    expect(trackAccountDeleted).not.toHaveBeenCalled()
  })
})
