'use client'

import { Icon } from '@iconify/react'

import type { FarmType } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

import type { StepProps } from './types'

const FARM_TYPE_OPTIONS: {
  value: FarmType
  label: string
  description: string
  icon: string
}[] = [
  {
    value: 'crop_farming',
    label: 'Crop Farming',
    description: 'Grains, legumes, oilseeds, cereals',
    icon: 'solar:wheat-bold'
  },
  {
    value: 'livestock',
    label: 'Livestock',
    description: 'Cattle, poultry, pigs, sheep',
    icon: 'solar:cow-bold'
  },
  {
    value: 'horticulture',
    label: 'Horticulture',
    description: 'Vegetables, fruits, ornamentals',
    icon: 'solar:leaf-bold'
  },
  {
    value: 'aquaculture',
    label: 'Aquaculture',
    description: 'Fish, shellfish, algae',
    icon: 'solar:swimming-bold'
  },
  {
    value: 'viticulture',
    label: 'Viticulture',
    description: 'Grapes and wine production',
    icon: 'solar:bottle-bold'
  },
  {
    value: 'agroforestry',
    label: 'Agroforestry',
    description: 'Trees integrated with crops or livestock',
    icon: 'solar:trees-bold'
  },
  {
    value: 'beekeeping',
    label: 'Beekeeping',
    description: 'Honey bees and pollination',
    icon: 'solar:bee-bold'
  },
  {
    value: 'mixed',
    label: 'Mixed',
    description: 'Combination of multiple types',
    icon: 'solar:layers-bold'
  }
]

export function Step1({ data, setData }: StepProps) {
  const toggleFarmType = (farmType: FarmType) => {
    setData(current => ({
      ...current,
      farmTypes: current.farmTypes.includes(farmType)
        ? current.farmTypes.filter(value => value !== farmType)
        : [...current.farmTypes, farmType]
    }))
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-normal">
          What type of farming do you do?
        </h1>
        <p className="text-muted-foreground">
          We use this to focus search results on practices relevant to your
          operation.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FARM_TYPE_OPTIONS.map(option => {
          const selected = data.farmTypes.includes(option.value)

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleFarmType(option.value)}
              className={cn(
                'rounded-lg border p-4 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                  : 'border-border bg-card hover:border-emerald-700/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 rounded-md p-2',
                    selected
                      ? 'bg-white/15 text-white'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                  )}
                >
                  <Icon icon={option.icon} className="size-5" />
                </span>
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>
                  <span
                    className={cn(
                      'block text-sm',
                      selected ? 'text-white/80' : 'text-muted-foreground'
                    )}
                  >
                    {option.description}
                  </span>
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <details className="rounded-lg border border-emerald-700/20 bg-emerald-50/70 p-4 text-sm text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-50">
        <summary className="cursor-pointer font-medium">
          Why do we ask this?
        </summary>
        <p className="mt-2 text-emerald-950/80 dark:text-emerald-50/80">
          Search ranking can favor sources, terms, and regulatory notes that
          match the kind of operation you run.
        </p>
      </details>
    </section>
  )
}
