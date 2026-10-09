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

  // Per-account refusal (e.g. the last admin) must happen before any
  // destructive step below, or a rejected deletion would still destroy
  // the user's data while leaving the account in place.
  const deleteCheck = await provider.canDeleteUser?.(user.id)
  if (deleteCheck) {
    return { success: false, error: deleteCheck }
  }

  try {
    const deleteChatsResult = await dbActions.deleteUserChats(user.id)
    if (!deleteChatsResult.success) {
      return {
        success: false,
        error: deleteChatsResult.error ?? 'Failed to delete account data'
      }
    }

    const deleteNotesResult = await dbActions.deleteUserNotes(user.id)
    if (!deleteNotesResult.success) {
      return {
        success: false,
        error: deleteNotesResult.error ?? 'Failed to delete account data'
      }
    }

    const deleteFilesResult = await dbActions.deleteUserLibraryFiles(user.id)
    if (!deleteFilesResult.success) {
      return {
        success: false,
        error: deleteFilesResult.error ?? 'Failed to delete account data'
      }
    }

    const anonymizeFeedbackResult = await dbActions.anonymizeUserFeedback(
      user.id
    )
    if (!anonymizeFeedbackResult.success) {
      return {
        success: false,
        error:
          anonymizeFeedbackResult.error ?? 'Failed to anonymize user feedback'
      }
    }

    await deleteUserObjects(user.id)

    const deleteAuthResult = await provider.deleteUser!(user.id)
    if (!deleteAuthResult.success) {
      throw new Error(deleteAuthResult.error ?? 'Failed to delete user')
    }

    revalidateTag('chat', 'max')
    await trackAccountDeleted(user.id)

    return { success: true }
  } catch (error) {
    console.error(`Error deleting account for user ${user.id}:`, error)
    return { success: false, error: getErrorMessage(error) }
  }
}
