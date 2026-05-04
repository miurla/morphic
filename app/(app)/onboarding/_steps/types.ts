import type { Dispatch, SetStateAction } from 'react'

import type { ClimateZone, FarmType } from '@/lib/supabase/types'

export type FarmSizeUnit = 'hectares' | 'acres'

export type OnboardingData = {
  farmTypes: FarmType[]
  primaryCrops: string[]
  farmSizeInput: string
  farmSizeUnit: FarmSizeUnit
  farmSizeHa: number | null
  countryCode: string
  region: string
  climateZone: ClimateZone | ''
  preferredLanguage: string
}

export type StepProps = {
  data: OnboardingData
  setData: Dispatch<SetStateAction<OnboardingData>>
}
