/**
 * Fixed-window in-process rate limiter for the auth actions that call
 * `auth.api.*` directly. Better Auth's own rate limiter runs only in
 * its HTTP handler, which Morphic does not mount, so without this the
 * sign-in, sign-up, and password-reset actions would be unthrottled.
 * Callers choose the keys (see attemptAllowed in the better-auth
 * provider). Morphic runs as a single instance (see
 * bootstrapSendLocks in the better-auth provider), so an in-process
 * map is sufficient; a multi-instance deployment would need a shared
 * store.
 */
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 10
const MAX_KEYS = 10_000

const buckets = new Map<string, { windowStart: number; count: number }>()

function evict(now: number): void {
  for (const [existing, bucket] of buckets) {
    if (now - bucket.windowStart < WINDOW_MS && buckets.size < MAX_KEYS) {
      break
    }
    buckets.delete(existing)
  }
}

/**
 * Returns true when the attempt is allowed. Every call — including the
 * first of a window — counts as an attempt.
 */
export function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    // Re-inserting keeps the map ordered by window start, oldest first.
    buckets.delete(key)
    if (buckets.size >= MAX_KEYS) {
      evict(now)
    }
    buckets.set(key, { windowStart: now, count: 1 })
    return true
  }
  bucket.count++
  return bucket.count <= MAX_ATTEMPTS
}

/** Test hook: number of tracked keys. */
export function rateLimitKeyCount(): number {
  return buckets.size
}

/** Test hook: clears all windows. */
export function resetRateLimits(): void {
  buckets.clear()
}
