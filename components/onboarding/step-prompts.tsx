'use client'

import { useState } from 'react'

import {
  Briefcase,
  Check,
  Loader2,
  MessageSquare,
  Rocket,
  Search,
  TrendingUp,
  Users
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from '../ui/button'

const SUGGESTED_PROMPTS = [
  {
    icon: Briefcase,
    label: 'Chercher des offres',
    prompt: "Chercher des offres d'emploi près de chez moi",
    color: 'text-blue-500 bg-blue-500/10'
  },
  {
    icon: Users,
    label: 'Qui recrute dans mon réseau ?',
    prompt: 'Qui recrute dans mon réseau LinkedIn en ce moment ?',
    color: 'text-purple-500 bg-purple-500/10'
  },
  {
    icon: TrendingUp,
    label: 'Tendances de mon réseau',
    prompt: "Quoi de neuf et d'intéressant dans mon réseau cette semaine ?",
    color: 'text-green-500 bg-green-500/10'
  },
  {
    icon: Search,
    label: 'Trouver des décideurs',
    prompt: 'Trouver des VP et directeurs dans mon secteur à proximité',
    color: 'text-amber-500 bg-amber-500/10'
  },
  {
    icon: MessageSquare,
    label: 'Rédiger un post LinkedIn',
    prompt: 'Aide-moi à planifier un post LinkedIn engageant pour cette semaine',
    color: 'text-pink-500 bg-pink-500/10'
  }
]

interface StepPromptsProps {
  onComplete: (data?: Record<string, unknown>) => Promise<void>
}

export function StepPrompts({ onComplete }: StepPromptsProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isLaunching, setIsLaunching] = useState(false)

  const pendingMessage =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('pendingMessage')
      : null

  const selectedPrompt =
    selectedIndex !== null
      ? SUGGESTED_PROMPTS[selectedIndex]?.prompt
      : pendingMessage

  const handleLaunch = () => {
    const prompt = selectedPrompt
    if (!prompt || isLaunching) return

    setIsLaunching(true)
    sessionStorage.setItem('pendingMessage', prompt)
    document.cookie = 'onboarding_completed=true; path=/; max-age=31536000'

    // Fire and forget — don't wait for DB write
    fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingCompleted: true, onboardingStep: 4 })
    })

    // Small delay to show loading state before redirect
    setTimeout(() => {
      window.location.href = '/'
    }, 200)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">C&apos;est parti !</h1>
        <p className="text-muted-foreground mt-2">
          Ton compte est configuré. Choisis ta première action et lance
          Melron.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Rocket className="size-10 text-primary" />
        </div>
      </div>

      {/* Pending message */}
      {pendingMessage && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Ton message en attente
          </p>
          <button
            onClick={() => setSelectedIndex(null)}
            className={cn(
              'w-full text-left rounded-xl border-2 p-4 transition-colors',
              selectedIndex === null
                ? 'border-primary bg-primary/5'
                : 'border-transparent hover:bg-muted/50'
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{pendingMessage}</p>
              {selectedIndex === null && (
                <Check className="size-4 text-primary shrink-0" />
              )}
            </div>
          </button>
        </div>
      )}

      {/* Suggested prompts */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {pendingMessage ? 'Ou essaie une de ces actions' : 'Choisis une action'}
        </p>
        <div className="grid gap-2">
          {SUGGESTED_PROMPTS.map((item, i) => {
            const Icon = item.icon
            const isSelected = selectedIndex === i
            return (
              <button
                key={i}
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:bg-muted/50'
                )}
              >
                <div
                  className={cn(
                    'size-10 rounded-lg flex items-center justify-center shrink-0',
                    item.color
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.prompt}
                  </p>
                </div>
                {isSelected && (
                  <Check className="size-4 text-primary shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Launch button */}
      <Button
        className="w-full gap-2"
        size="lg"
        onClick={handleLaunch}
        disabled={!selectedPrompt || isLaunching}
      >
        {isLaunching ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Lancement...
          </>
        ) : (
          <>
            <Rocket className="size-4" />
            Découvrir
          </>
        )}
      </Button>
    </div>
  )
}
