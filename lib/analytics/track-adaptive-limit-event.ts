import { capture } from './dispatch'

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
 */
export async function trackAdaptiveLimitEvent(
  data: AdaptiveLimitEventData
): Promise<void> {
  const { userId, outcome, used, limit } = data

  await capture({
    event: 'adaptive_limit_check',
    distinctId: userId,
    properties: { outcome, userId, used, limit }
  })
}
