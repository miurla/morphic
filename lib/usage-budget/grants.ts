import { and, eq, gt, sql } from 'drizzle-orm'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { usageGrants } from '@/lib/db/schema'
import { withRLS } from '@/lib/db/with-rls'

import { trackUsageGrantSyncFailed } from './analytics'
import { MONTHLY_ALLOWANCE } from './config'
import { getUsagePeriod } from './time'

export interface ActiveGrants {
  monthly: number
  monthlyExpiresAt: Date
}

export class UsageAnchorUnavailableError extends Error {
  constructor() {
    super('A trusted Supabase user creation timestamp is required')
    this.name = 'UsageAnchorUnavailableError'
  }
}

function parseAnchor(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? new Date(value) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function resolveUsageAnchor(
  userId: string,
  provided?: Date | string | null
): Promise<Date | null> {
  if (provided !== undefined) return parseAnchor(provided)

  const user = await getCurrentUser()
  if (!user || user.id !== userId) return null
  return parseAnchor(user.created_at)
}

export async function syncUsageGrants(params: {
  userId: string
  userCreatedAt?: Date | string | null
  now?: Date
}): Promise<ActiveGrants> {
  const now = params.now ?? new Date()
  const anchor = await resolveUsageAnchor(params.userId, params.userCreatedAt)

  if (!anchor || anchor.getTime() > now.getTime()) {
    void trackUsageGrantSyncFailed({
      userId: params.userId,
      grantKind: 'period',
      reason: 'missing_invalid_or_future_user_created_at'
    })
    throw new UsageAnchorUnavailableError()
  }

  const period = getUsagePeriod(anchor, now)
  const periodStart = new Date(period.periodStartAt)
  const periodEnd = new Date(period.resetAt)
  const idempotencyKey = `period:${period.periodKey}`

  return withRLS(params.userId, async tx => {
    await tx
      .insert(usageGrants)
      .values({
        userId: params.userId,
        idempotencyKey,
        kind: 'period',
        amount: MONTHLY_ALLOWANCE,
        grantedAt: periodStart,
        expiresAt: periodEnd
      })
      .onConflictDoNothing()

    const active = await tx
      .select({
        amount: usageGrants.amount,
        idempotencyKey: usageGrants.idempotencyKey,
        kind: usageGrants.kind,
        expiresAt: usageGrants.expiresAt
      })
      .from(usageGrants)
      .where(
        and(
          sql`${usageGrants.userId} = ${params.userId}`,
          eq(usageGrants.kind, 'period'),
          eq(usageGrants.idempotencyKey, idempotencyKey),
          gt(usageGrants.expiresAt, now)
        )
      )

    // Adjustment lifecycle and cache invalidation are not in Phase 1.
    const applicable = active.filter(
      grant =>
        grant.kind === 'period' && grant.idempotencyKey === idempotencyKey
    )
    const monthly = Math.max(
      0,
      applicable.reduce((sum, grant) => sum + grant.amount, 0)
    )
    const monthlyExpiresAt = applicable.reduce(
      (earliest, grant) =>
        grant.expiresAt.getTime() < earliest.getTime()
          ? grant.expiresAt
          : earliest,
      periodEnd
    )

    return { monthly, monthlyExpiresAt }
  })
}
