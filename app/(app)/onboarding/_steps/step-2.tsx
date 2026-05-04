'use client'

import { useMemo, useState } from 'react'

import { Icon } from '@iconify/react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

import type { StepProps } from './types'

const SUGGESTED_CROPS = [
  'Wheat',
  'Corn',
  'Maize',
  'Rice',
  'Soybean',
  'Sunflower',
  'Rapeseed',
  'Canola',
  'Potato',
  'Tomato',
  'Cotton',
  'Sugar Beet',
  'Sugar Cane',
  'Barley',
  'Oats',
  'Sorghum',
  'Chickpea',
  'Lentil',
  'Onion',
  'Garlic',
  'Pepper',
  'Cucumber',
  'Lettuce',
  'Spinach',
  'Apple',
  'Grape',
  'Olive',
  'Coffee',
  'Cocoa',
  'Tea'
]

export function Step2({ data, setData }: StepProps) {
  const [draft, setDraft] = useState('')

  const filteredSuggestions = useMemo(() => {
    const query = draft.trim().toLowerCase()
    if (!query) return SUGGESTED_CROPS.slice(0, 8)

    return SUGGESTED_CROPS.filter(
      crop =>
        crop.toLowerCase().includes(query) &&
        !data.primaryCrops.some(
          selected => selected.toLowerCase() === crop.toLowerCase()
        )
    ).slice(0, 8)
  }, [data.primaryCrops, draft])

  const addCrop = (cropName: string) => {
    const normalized = cropName.trim().replace(/\s+/g, ' ')
    if (!normalized) return

    setData(current => {
      if (
        current.primaryCrops.some(
          crop => crop.toLowerCase() === normalized.toLowerCase()
        )
      ) {
        return current
      }

      return {
        ...current,
        primaryCrops: [...current.primaryCrops, normalized]
      }
    })
    setDraft('')
  }

  const removeCrop = (cropName: string) => {
    setData(current => ({
      ...current,
      primaryCrops: current.primaryCrops.filter(crop => crop !== cropName)
    }))
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-normal">
          What are your main crops or products?
        </h1>
        <p className="text-muted-foreground">
          This helps us surface the most relevant research for what you grow.
        </p>
      </div>

      <div className="space-y-3">
        <Input
          value={draft}
          placeholder="Type a crop or product, then press Enter"
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addCrop(draft)
            }
          }}
        />

        {data.primaryCrops.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.primaryCrops.map(crop => (
              <Badge
                key={crop}
                variant="secondary"
                className="gap-1 rounded-md py-1 pr-1"
              >
                {crop}
                <button
                  type="button"
                  onClick={() => removeCrop(crop)}
                  className="rounded-sm p-0.5 hover:bg-background/70"
                  aria-label={`Remove ${crop}`}
                >
                  <Icon icon="solar:close-circle-bold" className="size-4" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {filteredSuggestions.map(crop => (
            <button
              key={crop}
              type="button"
              onClick={() => addCrop(crop)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-emerald-700/40 hover:bg-emerald-50 hover:text-foreground dark:hover:bg-emerald-950/20"
            >
              {crop}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          You can update this later in your profile.
        </p>
      </div>
    </section>
  )
}
