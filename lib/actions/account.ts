'use server'

import { revalidateTag } from 'next/cache'

import { trackAccountDeleted } from '@/lib/analytics'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getAuthProvider } from '@/lib/auth/provider'
import { db } from '@/lib/db'
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

    const cleanupFailed = (step: string, error: string) => {
      console.error(
        `Account deletion cleanup failed (${step}) for user ${user.id}: ${error}`
      )
      return { success: false as const, error }
    }

    // The authoritative guard (where the provider has one) runs inside
    // this transaction and holds its locks until it commits, so a
    // concurrent deletion cannot flip the answer before the identity is
    // removed. Cleanup runs after the guard but before the identity
    // deletion: a guard refusal precedes every destructive step, and a
    // cleanup failure leaves the account in place so the user can retry
    // (each step is idempotent). The cleanup steps run on their own
    // connections and R2 lives outside the database entirely, which is
    // why a rollback cannot undo partial cleanup — retrying the action
    // completes it instead.
    const result = await db.transaction(async tx => {
      let wasAdmin = false
      if (provider.validateDeletion) {
        const guard = await provider.validateDeletion(user.id, tx)
        if (guard.error) {
          return { success: false as const, error: guard.error }
        }
        wasAdmin = guard.wasAdmin
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

      const deleteAuthResult = await provider.deleteUser!(user.id, tx)
      if (!deleteAuthResult.success) {
        throw new Error(deleteAuthResult.error ?? 'Failed to delete user')
      }

      return { success: true, wasAdmin }
    })

    if (!result.success) {
      return { success: false, error: result.error }
    }

    // Runs after the deletion committed: completes any role election the
    // provider deferred because of concurrent sign-ups.
    await provider.postDeletion?.(result.wasAdmin)

    revalidateTag('chat', 'max')
    await trackAccountDeleted(user.id)

    return { success: true }
  } catch (error) {
    console.error(`Error deleting account for user ${user.id}:`, error)
    return { success: false, error: getErrorMessage(error) }
  }
}
