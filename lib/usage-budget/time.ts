export interface UsagePeriod {
  periodKey: string
  hourKey: string
  periodStartAt: number
  resetAt: number
  hourlyResetAt: number
  periodTtlSeconds: number
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function anniversaryInMonth(anchor: Date, year: number, month: number): Date {
  const date = new Date(0)
  date.setUTCFullYear(
    year,
    month,
    Math.min(anchor.getUTCDate(), daysInUtcMonth(year, month))
  )
  date.setUTCHours(
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
    anchor.getUTCMilliseconds()
  )
  return date
}

function adjacentMonth(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month + offset, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() }
}

/**
 * Return the user's current monthly usage cycle. Every boundary is calculated
 * from the original Supabase creation day/time, so a February clamp never
 * changes a day-29/30/31 user's March anchor.
 */
export function getUsagePeriod(anchor: Date, now = new Date()): UsagePeriod {
  if (
    Number.isNaN(anchor.getTime()) ||
    Number.isNaN(now.getTime()) ||
    now.getTime() < anchor.getTime()
  ) {
    throw new RangeError('A valid usage anchor at or before now is required')
  }

  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  let start = anniversaryInMonth(anchor, year, month)

  if (start.getTime() > now.getTime()) {
    const previous = adjacentMonth(year, month, -1)
    start = anniversaryInMonth(anchor, previous.year, previous.month)
  }

  // The first cycle cannot begin before the account exists.
  if (start.getTime() < anchor.getTime()) start = new Date(anchor)

  const next = adjacentMonth(start.getUTCFullYear(), start.getUTCMonth(), 1)
  const reset = anniversaryInMonth(anchor, next.year, next.month)
  const hourlyResetAt = Date.UTC(
    year,
    month,
    now.getUTCDate(),
    now.getUTCHours() + 1
  )

  return {
    periodKey: String(start.getTime()),
    hourKey: `${year}-${String(month + 1).padStart(2, '0')}-${String(
      now.getUTCDate()
    ).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}`,
    periodStartAt: start.getTime(),
    resetAt: reset.getTime(),
    hourlyResetAt,
    periodTtlSeconds: Math.max(
      1,
      Math.ceil((reset.getTime() - now.getTime()) / 1000)
    )
  }
}
