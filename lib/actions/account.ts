'use server'

import { revalidateTag } from 'next/cache'

import { trackAccountDeleted } from '@/lib/analytics'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getAuthProvider } from '@/lib/auth/provider'
import * as dbActions from '@/lib/db/actions'
import { deleteUserObjects } from '@/lib/storage/r2-client'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Failed to delete account'
}

export async function deleteAccount(): Promise<{
  success: boolean
  error?: string
}> {
  const provider = getAuthProvider()
  if (!provider.capabilities.deleteUser || !provider.deleteUser) {
    return {
      success: false,
      error: 'Account deletion is unavailable in anonymous mode.'
    }
  }

  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'User not authenticated' }
  }

  const configError = provider.validateDeleteUserConfig?.() ?? null
  if (configError) {
    return {
      success: false,
      error: configError
    }
  }

  try {
    // Per-account refusal (e.g. the last admin) before any destructive
    // step. A throw here must surface as an error result, not reject
    // the action.
    const deleteCheck = await provider.canDeleteUser?.(user.id)
    if (deleteCheck) {
      return { success: false, error: deleteCheck }
    }

    // The authoritative last-admin guard lives inside deleteUser, in a
    // locked transaction, and must run before any destructive step: a
    // concurrent deletion can flip the pre-check's answer, and a
    // rejection after the data cleanup would leave a retained account
    // whose chats, notes, and files were already erased. The accepted
    // trade-off: a cleanup failure below can no longer be retried by
    // the (already deleted) user, so each one logs the orphaned user
    // id for operator cleanup. Full atomicity is not possible — the R2
    // objects and, for Supabase, the auth deletion itself live outside
    // this database's transactions.
    const deleteAuthResult = await provider.deleteUser!(user.id)
    if (!deleteAuthResult.success) {
      return {
        success: false,
        error: deleteAuthResult.error ?? 'Failed to delete user'
      }
    }

    const cleanupFailed = (step: string, error: string) => {
      console.error(
        `Account deletion cleanup failed (${step}) for user ${user.id}: ${error}`
      )
      return { success: false, error }
    }

    const deleteChatsResult = await dbActions.deleteUserChats(user.id)
    if (!deleteChatsResult.success) {
      return cleanupFailed(
        'chats',
        deleteChatsResult.error ?? 'Failed to delete account data'
      )
    }

    const deleteNotesResult = await dbActions.deleteUserNotes(user.id)
    if (!deleteNotesResult.success) {
      return cleanupFailed(
        'notes',
        deleteNotesResult.error ?? 'Failed to delete account data'
      )
    }

    const deleteFilesResult = await dbActions.deleteUserLibraryFiles(user.id)
    if (!deleteFilesResult.success) {
      return cleanupFailed(
        'files',
        deleteFilesResult.error ?? 'Failed to delete account data'
      )
    }

    const anonymizeFeedbackResult = await dbActions.anonymizeUserFeedback(
      user.id
    )
    if (!anonymizeFeedbackResult.success) {
      return cleanupFailed(
        'feedback',
        anonymizeFeedbackResult.error ?? 'Failed to anonymize user feedback'
      )
    }

    await deleteUserObjects(user.id)

    revalidateTag('chat', 'max')
    await trackAccountDeleted(user.id)

    return { success: true }
  } catch (error) {
    console.error(`Error deleting account for user ${user.id}:`, error)
    return { success: false, error: getErrorMessage(error) }
  }
}
