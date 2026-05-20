import { track } from '@vercel/analytics/server'

/**
 * Track successful account deletion.
 *
 * Keep this event anonymous: the account has just been deleted, and the only
 * metric we need is the aggregate deletion count.
 */
export async function trackAccountDeleted(): Promise<void> {
  if (process.env.MORPHIC_CLOUD_DEPLOYMENT !== 'true') {
    return
  }

  try {
    await track('account_deleted')
  } catch (error) {
    console.error('Failed to track account deletion event:', error)
  }
}
