import { after } from 'next/server'

import { Redis } from '@upstash/redis'

import { trackChatLimitEvent } from '@/lib/analytics'
import { perfLog } from '@/lib/utils/perf-logging'

const DEFAULT_DAILY_CHAT_LIMIT = 100

function getDailyChatLimit(): number {
  const raw = process.env.OVERALL_CHAT_DAILY_LIMIT
  const parsed = raw ? Number(raw) : DEFAULT_DAILY_CHAT_LIMIT
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_CHAT_LIMIT
  }
  return Math.floor(parsed)
}

/**
 * Get seconds until next midnight UTC
 */
function getSecondsUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return Math.floor((midnight.getTime() - now.getTime()) / 1000)
}

/**
 * Get timestamp of next midnight UTC
 */
function getNextMidnightTimestamp(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return midnight.getTime()
}

async function checkOverallChatLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
  /** Current daily usage count after the check (incl. this attempt) */
  used: number
  /** True when the check ran against Redis (i.e. enforced) */
  enforced: boolean
}> {
  const limit = getDailyChatLimit()

  // If not in cloud deployment mode, allow unlimited requests
  if (process.env.MORPHIC_CLOUD_DEPLOYMENT !== 'true') {
    return {
      allowed: true,
      remaining: Infinity,
      resetAt: 0,
      limit,
      used: 0,
      enforced: false
    }
  }

  // If Upstash is not configured, allow unlimited requests
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return {
      allowed: true,
      remaining: Infinity,
      resetAt: 0,
      limit,
      used: 0,
      enforced: false
    }
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    })

    const dateKey = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const key = `rl:chat:${userId}:${dateKey}`

    const count = await Promise.race([
      redis.incr(key),
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout')), 3000)
      )
    ])

    if (count === 1) {
      const secondsUntilMidnight = getSecondsUntilMidnight()
      await redis.expire(key, secondsUntilMidnight)
    }

    const remaining = Math.max(0, limit - count)
    const resetAt = getNextMidnightTimestamp()

    return {
      allowed: count <= limit,
      remaining,
      resetAt,
      limit,
      used: count,
      enforced: true
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return {
      allowed: true,
      remaining: Infinity,
      resetAt: 0,
      limit,
      used: 0,
      enforced: false
    }
  }
}

/**
 * Check and enforce chat rate limit
 * Returns a 429 Response if limit is exceeded, null if allowed
 */
export async function checkAndEnforceOverallChatLimit(
  userId: string
): Promise<Response | null> {
  const result = await checkOverallChatLimit(userId)

  // Only emit analytics for real (Redis-backed) checks. Local dev / cloud
  // without Upstash returns enforced=false and we skip tracking to avoid
  // polluting the dashboard with no-op events.
  //
  // Hand the capture to `after` rather than letting it float: the blocked
  // path returns a 429 immediately, so an un-awaited PostHog flush can be
  // cut short when the serverless runtime freezes. Allowed requests go on
  // to a long-lived stream and would survive, which would bias the block
  // rate downward exactly where it matters.
  if (result.enforced) {
    after(
      trackChatLimitEvent({
        outcome: result.allowed ? 'allowed' : 'blocked',
        userId,
        used: result.used,
        limit: result.limit
      })
    )
  }

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Daily chat limit reached. Please try again tomorrow.',
        remaining: 0,
        resetAt: result.resetAt,
        limit: result.limit
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

  perfLog(`Chat usage: ${result.limit - result.remaining}/${result.limit}`)

  return null
}
