const DEFAULT_USAGE_COST_QUICK = 1
const DEFAULT_USAGE_COST_ADAPTIVE = 2
const DEFAULT_MONTHLY_ALLOWANCE = 100
const DEFAULT_HOURLY_GUARD = 30

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const USAGE_COST = {
  quick: positiveInteger(
    process.env.USAGE_COST_QUICK,
    DEFAULT_USAGE_COST_QUICK
  ),
  adaptive: positiveInteger(
    process.env.USAGE_COST_ADAPTIVE,
    DEFAULT_USAGE_COST_ADAPTIVE
  )
} as const

export const MONTHLY_ALLOWANCE = positiveInteger(
  process.env.MONTHLY_USAGE_ALLOWANCE,
  DEFAULT_MONTHLY_ALLOWANCE
)

export const HOURLY_GUARD = positiveInteger(
  process.env.HOURLY_USAGE_GUARD,
  DEFAULT_HOURLY_GUARD
)

export const ENFORCEMENT =
  process.env.USAGE_BUDGET_ENFORCEMENT === 'on' ? 'on' : 'shadow'

export const UI_ENABLED = process.env.USAGE_BUDGET_UI === 'on'

export function isUsageBudgetAvailable(): boolean {
  return (
    process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true' &&
    Boolean(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    )
  )
}
