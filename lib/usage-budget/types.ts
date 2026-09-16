export type UsageMode = 'quick' | 'adaptive'

export type UsageLimitReason = 'monthly' | 'hourly'

export interface UsageBudgetSnapshot {
  remaining: number
  limit: number
  resetAt: number
  refreshAt?: number
  costs?: Record<UsageMode, number>
}

export interface GateResult extends UsageBudgetSnapshot {
  allowed: boolean
  duplicate: boolean
  monthUsed: number
  hourUsed: number
  reason?: UsageLimitReason
  retryAt?: number
  cost: number
  enforced: boolean
}

export interface RefundResult extends UsageBudgetSnapshot {
  refunded: boolean
  duplicate: boolean
  monthUsed: number
  hourUsed: number
  amount: number
  enforced: boolean
}
