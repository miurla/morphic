'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { UsageLimitDialog } from '@/components/usage-limit-dialog'

export interface UsageBudget {
  remaining: number
  limit: number
  resetAt: string
  refreshAt?: string
  costs?: {
    quick: number
    adaptive: number
  }
}

interface UsageBudgetContextValue {
  enabled: boolean
  usage: UsageBudget | null
  isLow: boolean
  isExhausted: boolean
  costs: { quick: number; adaptive: number }
  refreshUsage: () => Promise<UsageBudget | null>
  consume: (amount: number) => void
  setUsage: (usage: UsageBudget | null) => void
  showUsageLimit: (resetAt?: string) => void
}

const noop = () => undefined
const noopAsync = async () => null

const UsageBudgetContext = createContext<UsageBudgetContextValue>({
  enabled: false,
  usage: null,
  isLow: false,
  isExhausted: false,
  costs: { quick: 1, adaptive: 2 },
  refreshUsage: noopAsync,
  consume: noop,
  setUsage: noop,
  showUsageLimit: noop
})

function isUsageBudget(value: unknown): value is UsageBudget {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<UsageBudget>
  return (
    typeof candidate.remaining === 'number' &&
    Number.isFinite(candidate.remaining) &&
    typeof candidate.limit === 'number' &&
    Number.isFinite(candidate.limit) &&
    typeof candidate.resetAt === 'string' &&
    (candidate.refreshAt === undefined ||
      typeof candidate.refreshAt === 'string') &&
    (candidate.costs === undefined ||
      (typeof candidate.costs.quick === 'number' &&
        Number.isFinite(candidate.costs.quick) &&
        typeof candidate.costs.adaptive === 'number' &&
        Number.isFinite(candidate.costs.adaptive)))
  )
}

export function UsageBudgetProvider({
  initialUsage,
  enabled = initialUsage !== null,
  children
}: {
  initialUsage: UsageBudget | null
  enabled?: boolean
  children: ReactNode
}) {
  const [usage, setUsage] = useState<UsageBudget | null>(
    enabled ? initialUsage : null
  )
  const [limitDialogOpen, setLimitDialogOpen] = useState(false)
  const [limitResetAt, setLimitResetAt] = useState<string | undefined>()
  const refreshedBoundaryRef = useRef<string | null>(null)
  const refreshingBoundaryRef = useRef(false)

  const refreshUsage = useCallback(async () => {
    if (!enabled) return null

    try {
      const response = await fetch('/api/usage', {
        method: 'GET',
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) return null

      const body: unknown = await response.json()
      const nextUsage = isUsageBudget(body)
        ? body
        : body && typeof body === 'object' && 'usage' in body
          ? (body as { usage: unknown }).usage
          : null

      if (!isUsageBudget(nextUsage)) return null

      setUsage(nextUsage)
      return nextUsage
    } catch {
      return null
    }
  }, [enabled])

  useEffect(() => {
    setUsage(enabled ? initialUsage : null)
    if (!enabled) {
      setLimitDialogOpen(false)
      setLimitResetAt(undefined)
      refreshedBoundaryRef.current = null
    }
  }, [enabled, initialUsage])

  useEffect(() => {
    if (!enabled || initialUsage !== null) return
    void refreshUsage()
  }, [enabled, initialUsage, refreshUsage])

  useEffect(() => {
    if (!enabled || !usage?.refreshAt) return

    const refreshAt = usage.refreshAt
    const refreshAtMs = new Date(refreshAt).getTime()
    if (!Number.isFinite(refreshAtMs)) return

    let timeout: number | undefined
    let cancelled = false
    const refreshAtBoundary = async () => {
      if (
        refreshedBoundaryRef.current === refreshAt ||
        refreshingBoundaryRef.current
      ) {
        return
      }

      refreshingBoundaryRef.current = true
      const refreshed = await refreshUsage()
      refreshingBoundaryRef.current = false
      if (cancelled) return

      if (refreshed) {
        refreshedBoundaryRef.current = refreshAt
      } else {
        timeout = window.setTimeout(() => {
          void refreshAtBoundary()
        }, 60_000)
      }
    }

    const scheduleRefresh = () => {
      const delay = refreshAtMs - Date.now()
      if (delay <= 0) {
        void refreshAtBoundary()
        return
      }

      timeout = window.setTimeout(
        scheduleRefresh,
        Math.min(delay + 1000, 2_147_483_647)
      )
    }

    scheduleRefresh()
    return () => {
      cancelled = true
      if (timeout !== undefined) window.clearTimeout(timeout)
    }
  }, [enabled, refreshUsage, usage?.refreshAt])

  const consume = useCallback(
    (amount: number) => {
      if (!enabled) return
      if (!Number.isFinite(amount) || amount <= 0) return

      setUsage(current =>
        current
          ? { ...current, remaining: Math.max(0, current.remaining - amount) }
          : null
      )
    },
    [enabled]
  )

  const showUsageLimit = useCallback(
    (resetAt?: string) => {
      if (!enabled) return
      setLimitResetAt(resetAt)
      setLimitDialogOpen(true)
    },
    [enabled]
  )

  const value = useMemo<UsageBudgetContextValue>(
    () => ({
      enabled,
      usage,
      isLow: usage !== null && usage.remaining <= 20,
      isExhausted: usage !== null && usage.remaining <= 0,
      costs: usage?.costs ?? { quick: 1, adaptive: 2 },
      refreshUsage,
      consume,
      setUsage,
      showUsageLimit
    }),
    [consume, enabled, refreshUsage, showUsageLimit, usage]
  )

  return (
    <UsageBudgetContext.Provider value={value}>
      {children}
      {enabled && (
        <UsageLimitDialog
          open={limitDialogOpen}
          onOpenChange={setLimitDialogOpen}
          resetAt={limitResetAt ?? usage?.resetAt}
        />
      )}
    </UsageBudgetContext.Provider>
  )
}

export function useUsageBudget() {
  return useContext(UsageBudgetContext)
}

export function UsageBudgetWarning() {
  const { enabled, usage, isLow } = useUsageBudget()

  if (!enabled || !usage || !isLow) return null

  return (
    <p
      className="mx-auto w-full max-w-3xl px-4 pb-2 text-sm text-destructive"
      role="status"
      aria-live="polite"
    >
      You&apos;re running low on monthly usage.{' '}
      <span className="tabular-nums">{Math.max(0, usage.remaining)}</span>{' '}
      remaining.
    </p>
  )
}
