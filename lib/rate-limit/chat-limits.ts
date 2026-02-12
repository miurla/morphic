import { Redis } from '@upstash/redis'

import { perfLog } from '@/lib/utils/perf-logging'

const DAILY_CHAT_LIMIT = 100

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
}> {
  // If not in cloud deployment mode, allow unlimited requests
  if (process.env.MORPHIC_CLOUD_DEPLOYMENT !== 'true') {
    return { allowed: true, remaining: Infinity, resetAt: 0 }
  }

  // If Upstash is not configured, allow unlimited requests
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return { allowed: true, remaining: Infinity, resetAt: 0 }
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

    const remaining = Math.max(0, DAILY_CHAT_LIMIT - count)
    const resetAt = getNextMidnightTimestamp()

    return {
      allowed: count <= DAILY_CHAT_LIMIT,
      remaining,
      resetAt
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return { allowed: true, remaining: Infinity, resetAt: 0 }
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

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Daily chat limit reached. Please try again tomorrow.',
        remaining: 0,
        resetAt: result.resetAt,
        limit: DAILY_CHAT_LIMIT
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(DAILY_CHAT_LIMIT),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt)
        }
      }
    )
  }

  perfLog(
    `Chat usage: ${DAILY_CHAT_LIMIT - result.remaining}/${DAILY_CHAT_LIMIT}`
  )

  return null
}
