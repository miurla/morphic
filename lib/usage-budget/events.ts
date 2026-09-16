import { sql } from 'drizzle-orm'

import { additionalUsageInterest, usageEvents } from '@/lib/db/schema'
import { withRLS } from '@/lib/db/with-rls'

import { trackAdditionalUsageInterest } from './analytics'
import type { UsageMode } from './types'

export async function recordUsageEvent(params: {
  userId: string
  eventType: 'spend' | 'refund' | 'limit_reached'
  amount: number
  mode?: UsageMode | null
  attemptId: string
  messageId?: string | null
  remaining?: number | null
}): Promise<void> {
  try {
    await withRLS(params.userId, async tx => {
      await tx
        .insert(usageEvents)
        .values({
          userId: params.userId,
          eventType: params.eventType,
          amount: params.amount,
          mode: params.mode ?? null,
          attemptId: params.attemptId,
          messageId: params.messageId ?? null,
          remaining: params.remaining ?? null
        })
        .onConflictDoNothing()
    })
  } catch (error) {
    // These events are explicitly best-effort and never affect the Redis
    // balance or whether a request is served.
    console.error('Failed to record usage event:', error)
  }
}

export async function recordAdditionalUsageInterest(
  userId: string
): Promise<void> {
  const now = new Date()

  await withRLS(userId, async tx => {
    await tx
      .insert(additionalUsageInterest)
      .values({
        userId,
        count: 1,
        firstClickedAt: now,
        lastClickedAt: now
      })
      .onConflictDoUpdate({
        target: additionalUsageInterest.userId,
        set: {
          count: sql`${additionalUsageInterest.count} + 1`,
          lastClickedAt: now
        }
      })
  })

  await trackAdditionalUsageInterest(userId)
}
