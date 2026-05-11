'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  Check,
  Linkedin,
  MessageCircle,
  Rocket,
  ShieldCheck
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { IconLogo } from '../ui/icons'
import { StepConnectLinkedIn } from './step-connect-linkedin'
import { StepOtpVerification } from './step-otp-verification'
import { StepPrompts } from './step-prompts'
import { StepWhatsapp } from './step-whatsapp'

const STEPS = [
  {
    id: 'linkedin',
    title: 'Connecter LinkedIn',
    description:
      'Associe ton compte LinkedIn pour accéder à la recherche de profils et d\'offres.',
    Icon: Linkedin
  },
  {
    id: 'verify',
    title: 'Vérification',
    description:
      'Confirme ton identité avec le code de vérification LinkedIn.',
    Icon: ShieldCheck
  },
  {
    id: 'whatsapp',
    title: 'Notifications',
    description:
      'Configure WhatsApp pour recevoir les alertes et résultats de tes recherches.',
    Icon: MessageCircle
  },
  {
    id: 'prompts',
    title: 'C\'est parti !',
    description:
      'Lance ta première recherche avec Melron.',
    Icon: Rocket
  }
]

async function saveStep(step: number, data?: Record<string, unknown>) {
  await fetch('/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      onboardingStep: step,
      ...(data ?? {})
    })
  })
}

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0)
  const router = useRouter()

  const handleNext = async (data?: Record<string, unknown>) => {
    // Allow steps to specify which step to jump to
    const jumpTo = data?.onboardingStep as number | undefined
    const nextStep = jumpTo ?? currentStep + 1
    await saveStep(nextStep, data)

    if (nextStep >= STEPS.length) {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingCompleted: true, onboardingStep: 4 })
      })
      router.push('/')
      return
    }

    setCurrentStep(nextStep)
  }

  const handleSkip = async () => {
    await handleNext()
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  return (
    <div className="flex min-h-svh">
      {/* Left panel — Stepper */}
      <div className="hidden lg:flex lg:w-[400px] bg-muted/30 border-r flex-col p-8">
        <div className="flex items-center gap-2 mb-10">
          <IconLogo className="size-6" />
          <span className="font-semibold">Melron</span>
        </div>

        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-8">
            Configure ton assistant en quelques étapes.
          </p>

          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const isCompleted = i < currentStep
              const isActive = i === currentStep
              const isLast = i === STEPS.length - 1
              const Icon = step.Icon

              return (
                <div key={step.id} className="flex gap-4">
                  {/* Icon + connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'size-10 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors',
                        isCompleted &&
                          'bg-primary border-primary text-primary-foreground',
                        isActive &&
                          'border-primary text-primary bg-primary/10',
                        !isCompleted &&
                          !isActive &&
                          'border-muted-foreground/30 text-muted-foreground/50'
                      )}
                    >
                      {isCompleted ? (
                        <Check className="size-5" />
                      ) : (
                        <Icon className="size-5" />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className={cn(
                          'w-px h-16 transition-colors',
                          isCompleted ? 'bg-primary' : 'bg-border'
                        )}
                      />
                    )}
                  </div>

                  {/* Text */}
                  <div className="pt-2 pb-8">
                    <h3
                      className={cn(
                        'text-sm font-semibold',
                        isActive
                          ? 'text-foreground'
                          : isCompleted
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                      )}
                    >
                      {step.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Propulsé par Melron
        </p>
      </div>

      {/* Right panel — Step content */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-lg">
          {/* Mobile step indicator */}
          <div className="lg:hidden mb-6 text-xs text-muted-foreground">
            ÉTAPE {currentStep + 1} SUR {STEPS.length}
          </div>
          <div className="hidden lg:block mb-2 text-xs font-medium text-primary tracking-wider">
            ÉTAPE {currentStep + 1} SUR {STEPS.length}
          </div>

          {currentStep === 0 && (
            <StepConnectLinkedIn onNext={handleNext} />
          )}
          {currentStep === 1 && (
            <StepOtpVerification onNext={handleNext} onBack={handleBack} />
          )}
          {currentStep === 2 && (
            <StepWhatsapp
              onNext={handleNext}
              onSkip={handleSkip}
              onBack={handleBack}
            />
          )}
          {currentStep === 3 && <StepPrompts onComplete={handleNext} />}
        </div>
      </div>
    </div>
  )
}
