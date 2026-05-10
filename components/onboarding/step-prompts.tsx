'use client'

import { useRouter } from 'next/navigation'

import {
  Briefcase,
  MessageSquare,
  Rocket,
  Search,
  TrendingUp,
  Users
} from 'lucide-react'

import { cn } from '@/lib/utils'

const SUGGESTED_PROMPTS = [
  {
    icon: Briefcase,
    label: 'Chercher des offres',
    prompt: 'Chercher des offres d\'emploi près de chez moi',
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
    prompt: 'Quoi de neuf et d\'intéressant dans mon réseau cette semaine ?',
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
  const router = useRouter()

  const pendingMessage =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('pendingMessage')
      : null

  const handlePromptClick = async (prompt: string) => {
    sessionStorage.setItem('pendingMessage', prompt)
    await onComplete()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">C&apos;est parti !</h1>
        <p className="text-muted-foreground mt-2">
          Ton compte est configuré. Lance ta première recherche avec Melron.
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
            onClick={() => handlePromptClick(pendingMessage)}
            className="w-full text-left rounded-xl border-2 border-primary bg-primary/5 p-4 hover:bg-primary/10 transition-colors"
          >
            <p className="text-sm font-medium">{pendingMessage}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cliquer pour lancer
            </p>
          </button>
        </div>
      )}

      {/* Suggested prompts */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Ou essaie une de ces actions
        </p>
        <div className="grid gap-2">
          {SUGGESTED_PROMPTS.map((item, i) => {
            const Icon = item.icon
            return (
              <button
                key={i}
                onClick={() => handlePromptClick(item.prompt)}
                className="flex items-center gap-3 rounded-xl border p-4 text-left hover:bg-muted/50 transition-colors group"
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
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.prompt}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
