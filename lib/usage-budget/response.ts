import type { GateResult } from './types'

export function usageLimitResponse(result: GateResult): Response {
  const reason = result.reason ?? 'monthly'
  const retryAt = result.retryAt ?? result.resetAt
  const error =
    reason === 'hourly'
      ? 'Too much usage in a short period. Please try again later.'
      : 'Monthly usage limit reached.'

  return new Response(
    JSON.stringify({
      error,
      type: 'rate-limit',
      code: 'usage_limit',
      usageLimitReached: true,
      reason,
      remaining: result.remaining,
      limit: result.limit,
      resetAt: result.resetAt,
      retryAt
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-Usage-Limit': String(result.limit),
        'X-Usage-Remaining': String(result.remaining),
        'X-Usage-Reset': String(result.resetAt),
        'Retry-After': String(
          Math.max(1, Math.ceil((retryAt - Date.now()) / 1000))
        )
      }
    }
  )
}
