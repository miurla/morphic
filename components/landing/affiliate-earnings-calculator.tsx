'use client'

import { useMemo, useState } from 'react'

import { Slider } from '@/components/ui/slider'

const PLAN_PRICES = [25, 50, 100, 200, 294]

export function AffiliateEarningsCalculator() {
  const [referrals, setReferrals] = useState(25)

  const monthly = useMemo(
    () => PLAN_PRICES.map(price => Math.round(referrals * price * 0.2)),
    [referrals]
  )

  const yearly = useMemo(() => monthly.map(amount => amount * 12), [monthly])

  return (
    <div className="rounded-[2rem] border bg-white p-6 shadow-xl md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            See what you could earn
          </h2>
          <p className="mt-2 text-muted-foreground">
            Your 20% commission on each plan price × your referrals.
          </p>
        </div>
        <div className="rounded-2xl bg-muted px-5 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Referrals / month
          </p>
          <p className="text-3xl font-bold">{referrals}</p>
        </div>
      </div>

      <div className="mt-8">
        <Slider
          min={1}
          max={1000}
          step={1}
          value={[referrals]}
          onValueChange={value => setReferrals(value[0] ?? 1)}
        />
        <div className="mt-3 flex justify-between text-xs font-medium text-muted-foreground">
          <span>1</span>
          <span>1,000</span>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border">
        <div className="grid grid-cols-6 bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">
          <span>Plan Price</span>
          {PLAN_PRICES.map(price => (
            <span key={price} className="text-right">
              ${price}/mo
            </span>
          ))}
        </div>
        <div className="grid grid-cols-6 px-4 py-4 text-sm">
          <span className="font-semibold">Monthly</span>
          {monthly.map((amount, index) => (
            <span key={PLAN_PRICES[index]} className="text-right font-bold">
              ${amount.toLocaleString()}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-6 border-t px-4 py-4 text-sm">
          <span className="font-semibold">Yearly</span>
          {yearly.map((amount, index) => (
            <span key={PLAN_PRICES[index]} className="text-right font-bold">
              ${amount.toLocaleString()}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Actual earnings may vary depending on plan mix, churn and billing cycle.
      </p>
    </div>
  )
}
