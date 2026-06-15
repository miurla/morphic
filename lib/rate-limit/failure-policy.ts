export type RateLimitKind = 'guest' | 'adaptive' | 'overall'
export type RateLimitFailurePolicy =
  | 'fail-open'
  | 'fail-closed'
  | 'emergency-cap'

const VALID_POLICIES = new Set<RateLimitFailurePolicy>([
  'fail-open',
  'fail-closed',
  'emergency-cap'
])

const emergencyCounters = new Map<string, { count: number; resetAt: number }>()

function normalizePolicy(value?: string): RateLimitFailurePolicy | undefined {
  return VALID_POLICIES.has(value as RateLimitFailurePolicy)
    ? (value as RateLimitFailurePolicy)
    : undefined
}

function envNameFor(kind: RateLimitKind) {
  switch (kind) {
    case 'guest':
      return 'GUEST_RATE_LIMIT_FAILURE_MODE'
    case 'adaptive':
      return 'ADAPTIVE_RATE_LIMIT_FAILURE_MODE'
    case 'overall':
      return 'OVERALL_RATE_LIMIT_FAILURE_MODE'
  }
}

function emergencyCapEnvNameFor(kind: RateLimitKind) {
  switch (kind) {
    case 'guest':
      return 'GUEST_RATE_LIMIT_EMERGENCY_CAP'
    case 'adaptive':
      return 'ADAPTIVE_RATE_LIMIT_EMERGENCY_CAP'
    case 'overall':
      return 'OVERALL_RATE_LIMIT_EMERGENCY_CAP'
  }
}

export function getRateLimitFailurePolicy(
  kind: RateLimitKind
): RateLimitFailurePolicy {
  const specific = normalizePolicy(process.env[envNameFor(kind)])
  if (specific) {
    return specific
  }

  const global = normalizePolicy(process.env.RATE_LIMIT_FAILURE_MODE)
  if (global) {
    return global
  }

  if (kind === 'guest' && process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true') {
    return 'fail-closed'
  }

  return 'fail-open'
}

function getEmergencyCap(kind: RateLimitKind): number {
  const raw =
    process.env[emergencyCapEnvNameFor(kind)] ??
    process.env.RATE_LIMIT_EMERGENCY_CAP
  const parsed = raw ? Number(raw) : 3

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 3
  }

  return Math.floor(parsed)
}

function getNextMidnightTimestamp(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return midnight.getTime()
}

export function recordEmergencyRateLimitAttempt(
  kind: RateLimitKind,
  identity: string
) {
  const limit = getEmergencyCap(kind)
  const key = `${kind}:${identity}`
  const now = Date.now()
  const existing = emergencyCounters.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = getNextMidnightTimestamp()
    emergencyCounters.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      used: 1,
      remaining: Math.max(0, limit - 1),
      limit,
      resetAt
    }
  }

  existing.count += 1
  return {
    allowed: existing.count <= limit,
    used: existing.count,
    remaining: Math.max(0, limit - existing.count),
    limit,
    resetAt: existing.resetAt
  }
}

export function clearEmergencyRateLimitCounters() {
  emergencyCounters.clear()
}
