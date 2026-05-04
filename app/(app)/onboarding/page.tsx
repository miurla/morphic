'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Icon } from '@iconify/react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

import { Step1 } from './_steps/step-1'
import { Step2 } from './_steps/step-2'
import { Step3 } from './_steps/step-3'
import { Step4 } from './_steps/step-4'
import { Step5 } from './_steps/step-5'
import type { OnboardingData } from './_steps/types'

const TOTAL_STEPS = 5
const SUPPORTED_LANGUAGES = [
  'en',
  'es',
  'fr',
  'pt',
  'ar',
  'hi',
  'sw',
  'ro',
  'de',
  'it'
]

const initialData: OnboardingData = {
  farmTypes: [],
  primaryCrops: [],
  farmSizeInput: '',
  farmSizeUnit: 'hectares',
  farmSizeHa: null,
  countryCode: '',
  region: '',
  climateZone: '',
  preferredLanguage: 'en'
}

function getBrowserLanguage(): string {
  if (typeof navigator === 'undefined') return 'en'

  const language = navigator.language.split('-')[0]?.toLowerCase() ?? 'en'
  return SUPPORTED_LANGUAGES.includes(language) ? language : 'en'
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>(initialData)
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  )
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setData(current => ({
      ...current,
      preferredLanguage: getBrowserLanguage()
    }))
  }, [])

  useEffect(() => {
    let ignore = false

    async function redirectIfComplete() {
      const supabase = createClient()
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (ignore) return
      if (!user) {
        router.replace('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle()

      if (!ignore && profile?.onboarding_completed) {
        router.replace('/chat')
      }
    }

    redirectIfComplete()

    return () => {
      ignore = true
    }
  }, [router])

  const activeStep = useMemo(() => {
    switch (step) {
      case 1:
        return <Step1 data={data} setData={setData} />
      case 2:
        return <Step2 data={data} setData={setData} />
      case 3:
        return <Step3 data={data} setData={setData} />
      case 4:
        return <Step4 data={data} setData={setData} />
      case 5:
      default:
        return <Step5 data={data} setData={setData} onEdit={setStep} />
    }
  }, [data, step])

  const validateCurrentStep = () => {
    if (step === 1 && data.farmTypes.length === 0) {
      setValidationMessage('Select at least one farm type to continue.')
      return false
    }

    if (step === 4 && !data.countryCode) {
      setValidationMessage('Select your country to continue.')
      return false
    }

    setValidationMessage(null)
    return true
  }

  const goNext = () => {
    if (!validateCurrentStep()) return
    setStep(current => Math.min(TOTAL_STEPS, current + 1))
  }

  const goBack = () => {
    setValidationMessage(null)
    setStep(current => Math.max(1, current - 1))
  }

  const finishOnboarding = async () => {
    if (!validateCurrentStep()) return

    const supabase = createClient()
    setIsSaving(true)

    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('User is not authenticated')

      const { error } = await supabase
        .from('user_profiles')
        .update({
          farm_types: data.farmTypes,
          primary_crops: data.primaryCrops,
          farm_size_ha: data.farmSizeHa,
          country_code: data.countryCode,
          region: data.region.trim() || null,
          climate_zone: data.climateZone || null,
          preferred_language: data.preferredLanguage,
          onboarding_completed: true
        })
        .eq('id', user.id)

      if (error) throw error

      router.replace('/chat')
      router.refresh()
    } catch {
      toast.error('Something went wrong saving your profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-6 py-8 sm:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-emerald-700 p-2 text-white">
            <Icon icon="solar:leaf-bold" className="size-5" />
          </span>
          <span className="font-semibold">AgriEvidence</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Step {step} of {TOTAL_STEPS}
        </div>
      </div>

      <div className="mb-8 flex gap-2" aria-hidden="true">
        {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map(
          stepNumber => (
            <div
              key={stepNumber}
              className={cn(
                'h-2 flex-1 rounded-full transition-colors',
                stepNumber <= step ? 'bg-emerald-700' : 'bg-muted'
              )}
            />
          )
        )}
      </div>

      <div className="flex-1">{activeStep}</div>

      {validationMessage && (
        <p className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {validationMessage}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={step === 1 || isSaving}
          className={cn(step === 1 && 'invisible')}
        >
          Back
        </Button>

        {step < TOTAL_STEPS ? (
          <Button type="button" onClick={goNext}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={finishOnboarding} disabled={isSaving}>
            {isSaving && (
              <Icon
                icon="solar:refresh-bold"
                className="mr-2 size-4 animate-spin"
              />
            )}
            {isSaving ? 'Saving...' : 'Start searching'}
          </Button>
        )}
      </div>
    </div>
  )
}
