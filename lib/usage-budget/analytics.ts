import { capture } from '@/lib/analytics/dispatch'

import type { UsageLimitReason, UsageMode } from './types'

export function trackUsageConsumed(data: {
  userId: string
  mode: UsageMode
  remaining: number
  enforcement: 'on' | 'shadow'
}): Promise<void> {
  return capture({
    event: 'usage_consumed',
    distinctId: data.userId,
    properties: {
      mode: data.mode,
      remaining: data.remaining,
      enforcement: data.enforcement
    }
  })
}

export function trackUsageLimitReached(data: {
  userId: string
  mode: UsageMode
  reason: UsageLimitReason
  enforcement: 'on' | 'shadow'
}): Promise<void> {
  return capture({
    event: 'usage_limit_reached',
    distinctId: data.userId,
    properties: {
      mode: data.mode,
      reason: data.reason,
      enforcement: data.enforcement
    }
  })
}

export function trackUsageGrantSyncFailed(data: {
  userId: string
  grantKind: 'period'
  reason: string
}): Promise<void> {
  return capture({
    event: 'usage_grant_sync_failed',
    distinctId: data.userId,
    properties: {
      grantKind: data.grantKind,
      reason: data.reason
    }
  })
}

export function trackAdditionalUsageInterest(userId: string): Promise<void> {
  return capture({
    event: 'additional_usage_interest',
    distinctId: userId
  })
}
