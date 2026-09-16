import { describe, expect, it } from 'vitest'

import { getUsagePeriod } from '../time'

describe('anniversary usage periods', () => {
  it.each([29, 30, 31])(
    'clamps a January %i anchor in February without drifting March',
    day => {
      const anchor = new Date(`2025-01-${day}T08:15:30.250Z`)
      const period = getUsagePeriod(
        anchor,
        new Date('2025-02-28T09:00:00.000Z')
      )

      expect(period.periodStartAt).toBe(Date.parse('2025-02-28T08:15:30.250Z'))
      expect(period.resetAt).toBe(Date.parse(`2025-03-${day}T08:15:30.250Z`))
    }
  )

  it('uses February 29 in a leap year and restores the original day', () => {
    const anchor = new Date('2024-01-31T23:45:00.000Z')
    const period = getUsagePeriod(anchor, new Date('2024-02-29T23:45:00.000Z'))

    expect(period.periodStartAt).toBe(Date.parse('2024-02-29T23:45:00.000Z'))
    expect(period.resetAt).toBe(Date.parse('2024-03-31T23:45:00.000Z'))
  })

  it('preserves a February 29 anchor across a non-leap February', () => {
    const anchor = new Date('2024-02-29T06:00:00.000Z')
    const period = getUsagePeriod(anchor, new Date('2025-02-28T06:00:00.000Z'))

    expect(period.periodStartAt).toBe(Date.parse('2025-02-28T06:00:00.000Z'))
    expect(period.resetAt).toBe(Date.parse('2025-03-29T06:00:00.000Z'))
  })

  it('treats an exact anniversary as the start of the next half-open cycle', () => {
    const anchor = new Date('2026-01-20T12:00:00.000Z')
    const period = getUsagePeriod(anchor, new Date('2026-09-20T12:00:00.000Z'))

    expect(period.periodStartAt).toBe(Date.parse('2026-09-20T12:00:00.000Z'))
    expect(period.resetAt).toBe(Date.parse('2026-10-20T12:00:00.000Z'))
    expect(period.periodKey).toBe(String(period.periodStartAt))
  })

  it('rejects missing temporal trust when now predates the anchor', () => {
    expect(() =>
      getUsagePeriod(
        new Date('2026-09-21T00:00:00.000Z'),
        new Date('2026-09-20T00:00:00.000Z')
      )
    ).toThrow(RangeError)
  })
})
