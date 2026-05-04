'use client'

import type { ClimateZone, FarmType } from '@/lib/supabase/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

import type { StepProps } from './types'

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'sw', label: 'Swahili' },
  { code: 'ro', label: 'Romanian' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' }
]

const FARM_TYPE_LABELS: Record<FarmType, string> = {
  crop_farming: 'Crop Farming',
  livestock: 'Livestock',
  horticulture: 'Horticulture',
  aquaculture: 'Aquaculture',
  viticulture: 'Viticulture',
  agroforestry: 'Agroforestry',
  beekeeping: 'Beekeeping',
  mixed: 'Mixed'
}

const CLIMATE_LABELS: Record<ClimateZone, string> = {
  tropical: 'Tropical',
  subtropical: 'Subtropical',
  temperate: 'Temperate',
  arid: 'Arid',
  semi_arid: 'Semi-Arid',
  mediterranean: 'Mediterranean'
}

type Step5Props = StepProps & {
  onEdit: (step: number) => void
}

function getCountryName(code: string): string {
  if (!code) return 'Not provided'
  return `${new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code} (${code})`
}

function getLanguageLabel(code: string): string {
  return (
    LANGUAGE_OPTIONS.find(language => language.code === code)?.label ?? code
  )
}

function SummaryRow({
  label,
  value,
  step,
  onEdit
}: {
  label: string
  value: string
  step: number
  onEdit: (step: number) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="break-words text-sm text-muted-foreground">{value}</p>
      </div>
      <Button
        type="button"
        variant="link"
        className="h-auto shrink-0 p-0 text-emerald-700"
        onClick={() => onEdit(step)}
      >
        Edit
      </Button>
    </div>
  )
}

export function Step5({ data, setData, onEdit }: Step5Props) {
  const summary = [
    {
      label: 'Farm type',
      value:
        data.farmTypes.length > 0
          ? data.farmTypes
              .map(farmType => FARM_TYPE_LABELS[farmType])
              .join(', ')
          : 'Not provided',
      step: 1
    },
    {
      label: 'Primary crops or products',
      value:
        data.primaryCrops.length > 0
          ? data.primaryCrops.join(', ')
          : 'Not provided',
      step: 2
    },
    {
      label: 'Farm size',
      value:
        data.farmSizeHa === null
          ? 'Not provided'
          : `${data.farmSizeHa.toFixed(2)} ha`,
      step: 3
    },
    {
      label: 'Location',
      value:
        [data.region.trim(), getCountryName(data.countryCode)]
          .filter(value => value && value !== 'Not provided')
          .join(', ') || 'Not provided',
      step: 4
    },
    {
      label: 'Climate zone',
      value: data.climateZone
        ? CLIMATE_LABELS[data.climateZone]
        : 'Not provided',
      step: 4
    },
    {
      label: 'Preferred language',
      value: getLanguageLabel(data.preferredLanguage),
      step: 5
    }
  ]

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-normal">
          Almost done - one last thing.
        </h1>
        <p className="text-muted-foreground">
          AgriEvidence can prioritize research results in your preferred
          language where available.
        </p>
      </div>

      <div className="grid gap-2">
        <Select
          value={data.preferredLanguage}
          onValueChange={preferredLanguage =>
            setData(current => ({ ...current, preferredLanguage }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map(language => (
              <SelectItem key={language.code} value={language.code}>
                {language.label} ({language.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-lg">Your profile summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.map(item => (
            <SummaryRow
              key={item.label}
              label={item.label}
              value={item.value}
              step={item.step}
              onEdit={onEdit}
            />
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
