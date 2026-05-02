import { track } from '@vercel/analytics/server'

export interface AdaptiveLimitEventData {
  /** Outcome of the adaptive-mode rate-limit check */
  outcome: 'allowed' | 'blocked'
  /** Authenticated Supabase user ID */
  userId: string
  /** Current daily usage count after the check (incl. this attempt) */
  used: number
  /** Effective daily limit at the time of the check */
  limit: number
}

/**
 * Track adaptive (Adaptive search mode) per-user daily limit events.
 *
 * Fires on every adaptive request:
 * - `outcome: "allowed"` while under the cap (with running counter), so we
 *   can plot daily usage distribution and percentiles.
 * - `outcome: "blocked"` when the request is denied, so we can monitor the
 *   429 hit-rate over time and decide whether to relax / tighten the cap.
 *
 * No-op outside cloud deployment; never throws.
 */
export async function trackAdaptiveLimitEvent(
  data: AdaptiveLimitEventData
): Promise<void> {
  if (process.env.MORPHIC_CLOUD_DEPLOYMENT !== 'true') {
    return
  }

  try {
    await track('adaptive_limit_check', {
      outcome: data.outcome,
      userId: data.userId,
      used: data.used,
      limit: data.limit
    })
  } catch (error) {
    console.error('Failed to track adaptive limit event:', error)
  }
}
