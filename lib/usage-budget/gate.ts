import { Redis } from '@upstash/redis'

import { getCurrentUser } from '@/lib/auth/get-current-user'

import { trackUsageGrantSyncFailed } from './analytics'
import {
  ENFORCEMENT,
  HOURLY_GUARD,
  isUsageBudgetAvailable,
  USAGE_COST
} from './config'
import { resolveUsageAnchor, syncUsageGrants } from './grants'
import { getUsagePeriod, type UsagePeriod } from './time'
import type {
  GateResult,
  RefundResult,
  UsageBudgetSnapshot,
  UsageLimitReason,
  UsageMode
} from './types'

const REDIS_TIMEOUT_MS = 3000
const HOURLY_TTL_SECONDS = 2 * 60 * 60
const ATTEMPT_TTL_SECONDS = 35 * 24 * 60 * 60

// KEYS: anniversary-period spend, hourly spend, attempt, active grant.
export const USAGE_GATE_SCRIPT = `
local existing = redis.call('HGETALL', KEYS[3])
if #existing > 0 then
  local values = {}
  for index = 1, #existing, 2 do
    values[existing[index]] = existing[index + 1]
  end
  return {
    tonumber(values.allowed), 1, tonumber(values.month_used),
    tonumber(values.hour_used), tonumber(values.remaining),
    values.reason or '', tonumber(values.cost), tonumber(values.usage_limit),
    tonumber(values.reset_at), tonumber(values.retry_at)
  }
end

local function parse_grant(value)
  if not value then return nil end
  local separator = string.find(value, '|', 1, true)
  if not separator then return tonumber(value) end
  return tonumber(string.sub(value, 1, separator - 1))
end

local cost = tonumber(ARGV[1])
local hourly_guard = tonumber(ARGV[2])
local enforcement = ARGV[3]
local period_ttl = tonumber(ARGV[4])
local hour_ttl = tonumber(ARGV[5])
local attempt_ttl = tonumber(ARGV[6])
local reset_at = tonumber(ARGV[7])
local hourly_retry_at = tonumber(ARGV[8])
local usage_limit = parse_grant(redis.call('GET', KEYS[4]))
if not usage_limit then
  return {-1, 0, 0, 0, 0, '', cost, 0, reset_at, reset_at}
end

local month_used = tonumber(redis.call('GET', KEYS[1]) or '0')
local hour_used = tonumber(redis.call('GET', KEYS[2]) or '0')
local budget_exceeded = month_used + cost > usage_limit
local hour_exceeded = hour_used + cost > hourly_guard
local allowed = not budget_exceeded and not hour_exceeded
local charged = allowed or enforcement == 'shadow'
local reason = ''

if budget_exceeded then reason = 'monthly'
elseif hour_exceeded then reason = 'hourly' end

if charged then
  local month_existed = redis.call('EXISTS', KEYS[1])
  local hour_existed = redis.call('EXISTS', KEYS[2])
  month_used = redis.call('INCRBY', KEYS[1], cost)
  hour_used = redis.call('INCRBY', KEYS[2], cost)
  if month_existed == 0 then redis.call('EXPIRE', KEYS[1], period_ttl) end
  if hour_existed == 0 then redis.call('EXPIRE', KEYS[2], hour_ttl) end
end

local remaining = math.max(0, usage_limit - month_used)
local retry_at = reason == 'hourly' and hourly_retry_at or reset_at
redis.call(
  'HSET', KEYS[3],
  'allowed', allowed and 1 or 0,
  'month_used', month_used,
  'hour_used', hour_used,
  'remaining', remaining,
  'reason', reason,
  'cost', cost,
  'usage_limit', usage_limit,
  'charged', charged and 1 or 0,
  'refunded', 0,
  'period_spend_key', KEYS[1],
  'hourly_spend_key', KEYS[2],
  'reset_at', reset_at,
  'retry_at', retry_at
)
redis.call('EXPIRE', KEYS[3], attempt_ttl)

return {
  allowed and 1 or 0, 0, month_used, hour_used, remaining,
  reason, cost, usage_limit, reset_at, retry_at
}
`

// KEYS are read from the immutable attempt metadata before this script runs:
// original period spend, original hourly spend, attempt.
export const USAGE_REFUND_SCRIPT = `
if redis.call('EXISTS', KEYS[3]) == 0 then
  return {0, 0, 0, 0, 0, 0, 0, 0}
end

local charged = tonumber(redis.call('HGET', KEYS[3], 'charged') or '0')
local refunded = tonumber(redis.call('HGET', KEYS[3], 'refunded') or '0')
local cost = tonumber(redis.call('HGET', KEYS[3], 'cost') or '0')
local usage_limit = tonumber(redis.call('HGET', KEYS[3], 'usage_limit') or '0')
local reset_at = tonumber(redis.call('HGET', KEYS[3], 'reset_at') or '0')
local month_used = tonumber(redis.call('GET', KEYS[1]) or '0')
local hour_used = tonumber(redis.call('GET', KEYS[2]) or '0')

if charged == 0 then
  return {0, 0, month_used, hour_used, math.max(0, usage_limit - month_used), 0, usage_limit, reset_at}
end
if refunded == 1 then
  return {0, 1, month_used, hour_used, math.max(0, usage_limit - month_used), cost, usage_limit, reset_at}
end

if redis.call('EXISTS', KEYS[1]) == 1 then
  month_used = redis.call('DECRBY', KEYS[1], cost)
  if month_used < 0 then redis.call('SET', KEYS[1], 0, 'KEEPTTL'); month_used = 0 end
end
if redis.call('EXISTS', KEYS[2]) == 1 then
  hour_used = redis.call('DECRBY', KEYS[2], cost)
  if hour_used < 0 then redis.call('SET', KEYS[2], 0, 'KEEPTTL'); hour_used = 0 end
end
redis.call('HSET', KEYS[3], 'refunded', 1)

return {1, 0, month_used, hour_used, math.max(0, usage_limit - month_used), cost, usage_limit, reset_at}
`

function getRedis(signal?: AbortSignal): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    ...(signal ? { signal } : {})
  })
}

async function withRedisTimeout<T>(
  operation: (redis: Redis) => Promise<T>
): Promise<T> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation(getRedis(controller.signal)),
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          const error = new Error('Usage budget Redis timeout')
          controller.abort(error)
          reject(error)
        }, REDIS_TIMEOUT_MS)
      })
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function keysFor(userId: string, attemptId: string, period: UsagePeriod) {
  return {
    period,
    periodSpend: `ub:v2:p:${userId}:${period.periodKey}`,
    hour: `ub:v2:h:${userId}:${period.hourKey}`,
    attempt: `ub:v2:a:${userId}:${attemptId}`,
    periodGrant: `ub:v2:g:${userId}:${period.periodKey}`
  }
}

function attemptKeyFor(userId: string, attemptId: string): string {
  return `ub:v2:a:${userId}:${attemptId}`
}

function encodeGrant(amount: number, expiresAt: number): string {
  return `${amount}|${expiresAt}`
}

function decodeGrant(value: string | null) {
  if (value === null) return null
  const [rawAmount, rawExpiry] = value.split('|')
  const amount = Number(rawAmount)
  const expiresAt = Number(rawExpiry)
  return Number.isFinite(amount) && Number.isFinite(expiresAt)
    ? { amount, expiresAt }
    : null
}

async function getOrSyncGrantLimit(params: {
  userId: string
  periodGrantKey: string
  userCreatedAt: Date
  now: Date
}): Promise<{ monthly: number; monthlyExpiresAt: number }> {
  const cached = decodeGrant(
    await withRedisTimeout(redis => redis.get<string>(params.periodGrantKey))
  )
  if (cached) {
    return { monthly: cached.amount, monthlyExpiresAt: cached.expiresAt }
  }

  const active = await syncUsageGrants({
    userId: params.userId,
    userCreatedAt: params.userCreatedAt,
    now: params.now
  })
  const monthlyExpiresAt = active.monthlyExpiresAt.getTime()
  const ttl = Math.max(
    1,
    Math.ceil((monthlyExpiresAt - params.now.getTime()) / 1000)
  )
  await withRedisTimeout(redis =>
    redis.set(
      params.periodGrantKey,
      encodeGrant(active.monthly, monthlyExpiresAt),
      { ex: ttl, nx: true }
    )
  )

  const winner = decodeGrant(
    await withRedisTimeout(redis => redis.get<string>(params.periodGrantKey))
  )
  return winner
    ? { monthly: winner.amount, monthlyExpiresAt: winner.expiresAt }
    : { monthly: active.monthly, monthlyExpiresAt }
}

function numberAt(values: unknown[], index: number): number {
  const value = Number(values[index])
  return Number.isFinite(value) ? value : 0
}

function parseGateResult(values: unknown[]): GateResult {
  const reason = values[5]
  return {
    allowed: numberAt(values, 0) === 1,
    duplicate: numberAt(values, 1) === 1,
    monthUsed: numberAt(values, 2),
    hourUsed: numberAt(values, 3),
    remaining: numberAt(values, 4),
    reason:
      reason === 'monthly' || reason === 'hourly'
        ? (reason as UsageLimitReason)
        : undefined,
    cost: numberAt(values, 6),
    limit: numberAt(values, 7),
    resetAt: numberAt(values, 8),
    retryAt: numberAt(values, 9),
    enforced: true
  }
}

async function usageAnchor(params: {
  userId: string
  userCreatedAt?: Date | string | null
}): Promise<Date | null> {
  return resolveUsageAnchor(params.userId, params.userCreatedAt)
}

function reportMissingAnchor(userId: string): void {
  void trackUsageGrantSyncFailed({
    userId,
    grantKind: 'period',
    reason: 'missing_invalid_or_future_user_created_at'
  })
}

export async function consumeUsage(params: {
  userId: string
  mode: UsageMode
  attemptId: string
  messageId?: string | null
  userCreatedAt?: Date | string | null
  now?: Date
}): Promise<GateResult> {
  const cost = USAGE_COST[params.mode]
  if (!isUsageBudgetAvailable()) return failOpenGate(cost)

  const now = params.now ?? new Date()
  try {
    const anchor = await usageAnchor(params)
    if (!anchor || anchor.getTime() > now.getTime()) {
      reportMissingAnchor(params.userId)
      return failOpenGate(cost)
    }

    const period = getUsagePeriod(anchor, now)
    const keys = keysFor(params.userId, params.attemptId, period)
    const attemptTtl = Math.max(
      ATTEMPT_TTL_SECONDS,
      period.periodTtlSeconds + 24 * 60 * 60
    )
    const evaluateGate = () =>
      withRedisTimeout(redis =>
        redis.eval<unknown[], unknown[]>(
          USAGE_GATE_SCRIPT,
          [keys.periodSpend, keys.hour, keys.attempt, keys.periodGrant],
          [
            cost,
            HOURLY_GUARD,
            ENFORCEMENT,
            period.periodTtlSeconds,
            HOURLY_TTL_SECONDS,
            attemptTtl,
            period.resetAt,
            period.hourlyResetAt
          ]
        )
      )

    // Let Lua replay a stored attempt before consulting the current period's
    // grant. This keeps duplicate detection available across a period boundary
    // even if synchronizing the new grant is temporarily unavailable.
    let values = await evaluateGate()
    if (numberAt(values, 0) === -1) {
      await getOrSyncGrantLimit({
        userId: params.userId,
        periodGrantKey: keys.periodGrant,
        userCreatedAt: anchor,
        now
      })
      values = await evaluateGate()
    }

    if (numberAt(values, 0) === -1) return failOpenGate(cost)
    return parseGateResult(values)
  } catch (error) {
    console.error('Usage budget check failed; allowing request:', error)
    return failOpenGate(cost)
  }
}

function failOpenGate(cost: number): GateResult {
  return {
    allowed: true,
    duplicate: false,
    monthUsed: 0,
    hourUsed: 0,
    remaining: Number.POSITIVE_INFINITY,
    limit: Number.POSITIVE_INFINITY,
    resetAt: 0,
    cost,
    enforced: false
  }
}

function stringField(
  value: Record<string, unknown> | null,
  key: string
): string | null {
  const field = value?.[key]
  return typeof field === 'string' && field ? field : null
}

export async function refundUsage(params: {
  userId: string
  attemptId: string
  now?: Date
}): Promise<RefundResult> {
  if (!isUsageBudgetAvailable()) return failedRefund()

  try {
    const attemptKey = attemptKeyFor(params.userId, params.attemptId)
    const attempt = await withRedisTimeout(redis =>
      redis.hgetall<Record<string, unknown>>(attemptKey)
    )
    const periodSpend = stringField(attempt, 'period_spend_key')
    const hourlySpend = stringField(attempt, 'hourly_spend_key')
    if (!periodSpend || !hourlySpend) return failedRefund(true)

    const values = await withRedisTimeout(redis =>
      redis.eval<unknown[], unknown[]>(
        USAGE_REFUND_SCRIPT,
        [periodSpend, hourlySpend, attemptKey],
        []
      )
    )

    return {
      refunded: numberAt(values, 0) === 1,
      duplicate: numberAt(values, 1) === 1,
      monthUsed: numberAt(values, 2),
      hourUsed: numberAt(values, 3),
      remaining: numberAt(values, 4),
      amount: numberAt(values, 5),
      limit: numberAt(values, 6),
      resetAt: numberAt(values, 7),
      enforced: true
    }
  } catch (error) {
    console.error('Usage budget refund failed:', error)
    return failedRefund()
  }
}

function failedRefund(enforced = false): RefundResult {
  return {
    refunded: false,
    duplicate: false,
    monthUsed: 0,
    hourUsed: 0,
    remaining: Number.POSITIVE_INFINITY,
    limit: Number.POSITIVE_INFINITY,
    resetAt: 0,
    amount: 0,
    enforced
  }
}

export async function getUsageBudget(params?: {
  userId?: string
  userCreatedAt?: Date | string | null
  now?: Date
}): Promise<UsageBudgetSnapshot | null> {
  if (!isUsageBudgetAvailable()) return null

  const user = params?.userId ? null : await getCurrentUser()
  const userId = params?.userId ?? user?.id
  if (!userId) return null

  const now = params?.now ?? new Date()
  try {
    const requestedCreatedAt =
      params?.userCreatedAt !== undefined
        ? params.userCreatedAt
        : user?.created_at
    const anchor = await usageAnchor({
      userId,
      userCreatedAt: requestedCreatedAt
    })
    if (!anchor || anchor.getTime() > now.getTime()) {
      reportMissingAnchor(userId)
      return null
    }

    const period = getUsagePeriod(anchor, now)
    const keys = keysFor(userId, 'snapshot', period)
    const grant = await getOrSyncGrantLimit({
      userId,
      periodGrantKey: keys.periodGrant,
      userCreatedAt: anchor,
      now
    })
    const used = Number(
      (await withRedisTimeout(redis => redis.get<number>(keys.periodSpend))) ??
        0
    )

    return {
      remaining: Math.max(0, grant.monthly - used),
      limit: grant.monthly,
      resetAt: period.resetAt,
      refreshAt: period.resetAt,
      costs: USAGE_COST
    }
  } catch (error) {
    console.error('Failed to read usage budget:', error)
    return null
  }
}
