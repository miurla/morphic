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

// Serializes account deletion within this process. The better-auth flow
// holds a pooled connection for its guard transaction while the cleanup
// steps check out their own connections; unbounded concurrent deletions
// could occupy the whole pool (each outer transaction waiting on inner
// cleanup connections that can no longer be checked out). Deletions are
// rare, so an in-process chain bounds the held connections to one per
// process.
let deletionChain: Promise<unknown> = Promise.resolve()

function withDeletionLock<T>(task: () => Promise<T>): Promise<T> {
  const result = deletionChain.then(task, task)
  deletionChain = result.then(
    () => undefined,
    () => undefined
  )
  return result
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

    const cleanup = async (): Promise<
      { success: true } | { success: false; error: string }
    > => {
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
      return { success: true as const }
    }

    let wasAdmin = false
    let result: { success: true } | { success: false; error: string }

    if (provider.validateDeletion) {
      // better-auth: guard, identity deletion, and cleanup share one
      // transaction. The guard's FOR UPDATE locks are held until the
      // commit, so a concurrent deletion cannot flip the answer. The
      // identity delete runs before the cleanup inside that transaction:
      // a failed delete rolls back with nothing destroyed, and a cleanup
      // failure rolls the identity back too, leaving the user able to
      // retry. The cleanup steps run on their own connections (RLS
      // transactions), so a rollback cannot undo partial cleanup —
      // retrying the action completes it. The transaction holds a pooled
      // connection while cleanup checks out another, so deletions are
      // serialized in-process (withDeletionLock) to keep the pool from
      // being exhausted by outer transactions waiting on inner ones.
      result = await withDeletionLock(() =>
        db.transaction(async tx => {
          const guard = await provider.validateDeletion!(user.id, tx)
          if (guard.error) {
            return { success: false as const, error: guard.error }
          }
          wasAdmin = guard.wasAdmin

          const deleteAuthResult = await provider.deleteUser!(user.id, tx)
          if (!deleteAuthResult.success) {
            throw new Error(deleteAuthResult.error ?? 'Failed to delete user')
          }

          return await cleanup()
        })
      )
    } else {
      // supabase: the identity deletion is an admin-API call that cannot
      // join a transaction, so it runs last: a cleanup failure leaves the
      // account in place and the user can retry (each step is
      // idempotent). A failed identity deletion after committed cleanup
      // is the accepted mirror of that trade-off — the account and its
      // sessions survive, so retrying the deletion completes it.
      const cleanupResult = await cleanup()
      if (!cleanupResult.success) {
        result = cleanupResult
      } else {
        const deleteAuthResult = await provider.deleteUser!(user.id)
        if (deleteAuthResult.success) {
          result = { success: true as const }
        } else {
          const error = deleteAuthResult.error ?? 'Failed to delete user'
          console.error(
            `Account deletion identity step failed for user ${user.id}: ${error}`
          )
          result = { success: false as const, error }
        }
      }
    }

    if (!result.success) {
      return { success: false, error: result.error }
    }

    // Runs after the deletion committed: completes any role election the
    // provider deferred because of concurrent sign-ups.
    await provider.postDeletion?.(wasAdmin)

    revalidateTag('chat', 'max')
    await trackAccountDeleted(user.id)

    return { success: true }
  } catch (error) {
    console.error(`Error deleting account for user ${user.id}:`, error)
    return { success: false, error: getErrorMessage(error) }
  }
}
