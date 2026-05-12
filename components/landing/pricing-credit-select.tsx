'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

const CREDIT_OPTIONS = [
  '100 credits / month',
  '200 credits / month',
  '400 credits / month',
  '800 credits / month',
  '1200 credits / month',
  '2000 credits / month',
  '3000 credits / month',
  '4000 credits / month',
  '5000 credits / month',
  '7500 credits / month',
  '10000 credits / month'
]

export function PricingCreditSelect() {
  return (
    <Select defaultValue={CREDIT_OPTIONS[0]}>
      <SelectTrigger className="h-12 rounded-lg border bg-white px-4 text-sm shadow-sm focus:ring-0 focus:ring-offset-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-lg border bg-white text-black shadow-xl">
        {CREDIT_OPTIONS.map(option => (
          <SelectItem
            key={option}
            value={option}
            className="text-sm focus:bg-muted focus:text-black"
          >
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
