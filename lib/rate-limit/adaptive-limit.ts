import { Redis } from '@upstash/redis'

import { trackAdaptiveLimitEvent } from '@/lib/analytics'
import { perfLog } from '@/lib/utils/perf-logging'

const DEFAULT_ADAPTIVE_DAILY_LIMIT = 30

function getAdaptiveDailyLimit(): number {
  const raw = process.env.ADAPTIVE_CHAT_DAILY_LIMIT
  const parsed = raw ? Number(raw) : DEFAULT_ADAPTIVE_DAILY_LIMIT
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_ADAPTIVE_DAILY_LIMIT
  }
  return Math.floor(parsed)
}

function getSecondsUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return Math.floor((midnight.getTime() - now.getTime()) / 1000)
}

function getNextMidnightTimestamp(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return midnight.getTime()
}

interface AdaptiveLimitCheckResult {
  allowed: boolean
  /** Current count after this attempt is included */
  used: number
  remaining: number
  resetAt: number
  limit: number
  /** True when the check ran against Redis (i.e. enforced) */
  enforced: boolean
}

async function checkAdaptiveLimit(
  userId: string
): Promise<AdaptiveLimitCheckResult> {
  const limit = getAdaptiveDailyLimit()

  if (process.env.MORPHIC_CLOUD_DEPLOYMENT !== 'true') {
    return {
      allowed: true,
      used: 0,
      remaining: Infinity,
      resetAt: 0,
      limit,
      enforced: false
    }
  }

  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return {
      allowed: true,
      used: 0,
      remaining: Infinity,
      resetAt: 0,
      limit,
      enforced: false
    }
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    })

    const dateKey = new Date().toISOString().split('T')[0]
    const key = `rl:adaptive:${userId}:${dateKey}`

    const count = await Promise.race([
      redis.incr(key),
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout')), 3000)
      )
    ])

    if (count === 1) {
      await redis.expire(key, getSecondsUntilMidnight())
    }

    return {
      allowed: count <= limit,
      used: count,
      remaining: Math.max(0, limit - count),
      resetAt: getNextMidnightTimestamp(),
      limit,
      enforced: true
    }
  } catch (error) {
    console.error('Adaptive rate limit check failed:', error)
    return {
      allowed: true,
      used: 0,
      remaining: Infinity,
      resetAt: 0,
      limit,
      enforced: false
    }
  }
}

/**
 * Enforce per-user daily limit on adaptive search mode.
 * Returns a 429 Response if the limit is reached, null otherwise.
 */
export async function checkAndEnforceAdaptiveLimit(
  userId: string
): Promise<Response | null> {
  const result = await checkAdaptiveLimit(userId)

  // Only emit analytics for real (Redis-backed) checks. Local dev / cloud
  // without Upstash returns enforced=false and we skip tracking to avoid
  // polluting the dashboard with no-op events.
  if (result.enforced) {
    void trackAdaptiveLimitEvent({
      outcome: result.allowed ? 'allowed' : 'blocked',
      userId,
      used: result.used,
      limit: result.limit
    })
  }

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error:
          'Daily limit for Adaptive mode reached. Please try again tomorrow, or continue in Quick mode.',
        remaining: 0,
        resetAt: result.resetAt,
        limit: result.limit,
        mode: 'adaptive'
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt)
        }
      }
    )
  }

  perfLog(`Adaptive usage: ${result.used}/${result.limit}`)

  return null
}
