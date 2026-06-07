import { capture, deleteAnalyticsPerson } from './dispatch'

/** Distinct id for the anonymous deletion counter (no link to the user). */
const ACCOUNT_LIFECYCLE_DISTINCT_ID = 'account-lifecycle'

/**
 * Track a successful account deletion.
 *
 * Records an anonymous aggregate count, then removes the deleted user's
 * person and events from analytics.
 */
export async function trackAccountDeleted(userId: string): Promise<void> {
  await capture({
    event: 'account_deleted',
    distinctId: ACCOUNT_LIFECYCLE_DISTINCT_ID
  })

  await deleteAnalyticsPerson(userId)
}
