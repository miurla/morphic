'use client'

import { useMemo, useState } from 'react'

import { Icon } from '@iconify/react'

import type { ClimateZone } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'

import type { StepProps } from './types'

const COMMON_COUNTRY_CODES = [
  'RO',
  'US',
  'BR',
  'IN',
  'AR',
  'AU',
  'FR',
  'DE',
  'UA',
  'CA',
  'CN',
  'NG',
  'KE',
  'ET',
  'ID'
]

const ISO_COUNTRY_CODES = [
  'AD',
  'AE',
  'AF',
  'AG',
  'AI',
  'AL',
  'AM',
  'AO',
  'AQ',
  'AR',
  'AS',
  'AT',
  'AU',
  'AW',
  'AX',
  'AZ',
  'BA',
  'BB',
  'BD',
  'BE',
  'BF',
  'BG',
  'BH',
  'BI',
  'BJ',
  'BL',
  'BM',
  'BN',
  'BO',
  'BQ',
  'BR',
  'BS',
  'BT',
  'BV',
  'BW',
  'BY',
  'BZ',
  'CA',
  'CC',
  'CD',
  'CF',
  'CG',
  'CH',
  'CI',
  'CK',
  'CL',
  'CM',
  'CN',
  'CO',
  'CR',
  'CU',
  'CV',
  'CW',
  'CX',
  'CY',
  'CZ',
  'DE',
  'DJ',
  'DK',
  'DM',
  'DO',
  'DZ',
  'EC',
  'EE',
  'EG',
  'EH',
  'ER',
  'ES',
  'ET',
  'FI',
  'FJ',
  'FK',
  'FM',
  'FO',
  'FR',
  'GA',
  'GB',
  'GD',
  'GE',
  'GF',
  'GG',
  'GH',
  'GI',
  'GL',
  'GM',
  'GN',
  'GP',
  'GQ',
  'GR',
  'GS',
  'GT',
  'GU',
  'GW',
  'GY',
  'HK',
  'HM',
  'HN',
  'HR',
  'HT',
  'HU',
  'ID',
  'IE',
  'IL',
  'IM',
  'IN',
  'IO',
  'IQ',
  'IR',
  'IS',
  'IT',
  'JE',
  'JM',
  'JO',
  'JP',
  'KE',
  'KG',
  'KH',
  'KI',
  'KM',
  'KN',
  'KP',
  'KR',
  'KW',
  'KY',
  'KZ',
  'LA',
  'LB',
  'LC',
  'LI',
  'LK',
  'LR',
  'LS',
  'LT',
  'LU',
  'LV',
  'LY',
  'MA',
  'MC',
  'MD',
  'ME',
  'MF',
  'MG',
  'MH',
  'MK',
  'ML',
  'MM',
  'MN',
  'MO',
  'MP',
  'MQ',
  'MR',
  'MS',
  'MT',
  'MU',
  'MV',
  'MW',
  'MX',
  'MY',
  'MZ',
  'NA',
  'NC',
  'NE',
  'NF',
  'NG',
  'NI',
  'NL',
  'NO',
  'NP',
  'NR',
  'NU',
  'NZ',
  'OM',
  'PA',
  'PE',
  'PF',
  'PG',
  'PH',
  'PK',
  'PL',
  'PM',
  'PN',
  'PR',
  'PS',
  'PT',
  'PW',
  'PY',
  'QA',
  'RE',
  'RO',
  'RS',
  'RU',
  'RW',
  'SA',
  'SB',
  'SC',
  'SD',
  'SE',
  'SG',
  'SH',
  'SI',
  'SJ',
  'SK',
  'SL',
  'SM',
  'SN',
  'SO',
  'SR',
  'SS',
  'ST',
  'SV',
  'SX',
  'SY',
  'SZ',
  'TC',
  'TD',
  'TF',
  'TG',
  'TH',
  'TJ',
  'TK',
  'TL',
  'TM',
  'TN',
  'TO',
  'TR',
  'TT',
  'TV',
  'TW',
  'TZ',
  'UA',
  'UG',
  'UM',
  'US',
  'UY',
  'UZ',
  'VA',
  'VC',
  'VE',
  'VG',
  'VI',
  'VN',
  'VU',
  'WF',
  'WS',
  'YE',
  'YT',
  'ZA',
  'ZM',
  'ZW'
]

const CLIMATE_DEFAULTS: Partial<Record<string, ClimateZone>> = {
  RO: 'temperate',
  US: 'temperate',
  BR: 'tropical',
  IN: 'subtropical',
  AR: 'temperate',
  AU: 'semi_arid',
  FR: 'temperate',
  DE: 'temperate',
  UA: 'temperate',
  CA: 'temperate',
  CN: 'temperate',
  NG: 'tropical',
  KE: 'semi_arid',
  ET: 'semi_arid',
  ID: 'tropical',
  ES: 'mediterranean',
  IT: 'mediterranean',
  PT: 'mediterranean',
  MA: 'semi_arid',
  EG: 'arid',
  MX: 'subtropical',
  ZA: 'semi_arid'
}

const CLIMATE_OPTIONS: {
  value: ClimateZone
  label: string
  description: string
}[] = [
  {
    value: 'tropical',
    label: 'Tropical',
    description: 'Year-round warmth, high rainfall'
  },
  {
    value: 'subtropical',
    label: 'Subtropical',
    description: 'Hot summers, mild winters'
  },
  {
    value: 'temperate',
    label: 'Temperate',
    description: 'Distinct seasons, moderate rainfall'
  },
  {
    value: 'arid',
    label: 'Arid',
    description: 'Very low rainfall, desert conditions'
  },
  {
    value: 'semi_arid',
    label: 'Semi-Arid',
    description: 'Low rainfall, grassland conditions'
  },
  {
    value: 'mediterranean',
    label: 'Mediterranean',
    description: 'Dry summers, wet mild winters'
  }
]

function getCountryName(code: string): string {
  return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
}

export function Step4({ data, setData }: StepProps) {
  const [open, setOpen] = useState(false)

  const countries = useMemo(() => {
    const common = COMMON_COUNTRY_CODES.map(code => ({
      code,
      name: getCountryName(code),
      common: true
    }))
    const rest = ISO_COUNTRY_CODES.filter(
      code => !COMMON_COUNTRY_CODES.includes(code)
    )
      .map(code => ({ code, name: getCountryName(code), common: false }))
      .sort((left, right) => left.name.localeCompare(right.name))

    return [...common, ...rest]
  }, [])

  const selectedCountry = countries.find(
    country => country.code === data.countryCode
  )
  const suggestedClimate = data.countryCode
    ? CLIMATE_DEFAULTS[data.countryCode]
    : undefined

  const selectCountry = (countryCode: string) => {
    const defaultClimate = CLIMATE_DEFAULTS[countryCode]

    setData(current => ({
      ...current,
      countryCode,
      climateZone: current.climateZone || defaultClimate || ''
    }))
    setOpen(false)
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-normal">
          Where is your farm located?
        </h1>
        <p className="text-muted-foreground">
          Location allows us to prioritize research from your climate zone and
          local regulatory context.
        </p>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-2">
          <Label>Country</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="h-10 justify-between font-normal"
              >
                {selectedCountry
                  ? `${selectedCountry.name} (${selectedCountry.code})`
                  : 'Select country'}
                <Icon
                  icon="solar:alt-arrow-down-bold"
                  className="size-4 opacity-60"
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(calc(100vw-2rem),28rem)] p-0"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Search countries..." />
                <CommandList>
                  <CommandEmpty>No country found.</CommandEmpty>
                  <CommandGroup heading="Countries">
                    {countries.map(country => (
                      <CommandItem
                        key={country.code}
                        value={`${country.name} ${country.code}`}
                        onSelect={() => selectCountry(country.code)}
                      >
                        <Icon
                          icon={
                            data.countryCode === country.code
                              ? 'solar:check-circle-bold'
                              : 'solar:map-point-bold'
                          }
                          className="size-4 text-emerald-700"
                        />
                        <span>{country.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {country.code}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="region">State, province, or region (optional)</Label>
          <Input
            id="region"
            value={data.region}
            placeholder="e.g. Muntenia, Iowa, Sao Paulo"
            onChange={event =>
              setData(current => ({ ...current, region: event.target.value }))
            }
          />
        </div>

        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Climate zone</Label>
            {suggestedClimate && (
              <p className="text-sm text-muted-foreground">
                Suggested for {data.countryCode}:{' '}
                {suggestedClimate.replace('_', '-')}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {CLIMATE_OPTIONS.map(option => {
              const selected = data.climateZone === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setData(current => ({
                      ...current,
                      climateZone: option.value
                    }))
                  }
                  className={cn(
                    'rounded-lg border p-4 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                      : 'border-border bg-card hover:border-emerald-700/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                  )}
                >
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>
                  <span
                    className={cn(
                      'mt-1 block text-sm',
                      selected ? 'text-white/80' : 'text-muted-foreground'
                    )}
                  >
                    {option.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <details className="rounded-lg border border-emerald-700/20 bg-emerald-50/70 p-4 text-sm text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-50">
        <summary className="cursor-pointer font-medium">
          Why do we ask this?
        </summary>
        <p className="mt-2 text-emerald-950/80 dark:text-emerald-50/80">
          Region and climate improve search relevance significantly, especially
          for pest pressure, water management, and regulated products.
        </p>
      </details>
    </section>
  )
}
