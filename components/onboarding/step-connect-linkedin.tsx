'use client'

import { useState } from 'react'

import {
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  Lock
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { PasswordInput } from '../ui/password-input'

const SOCIALS = [
  { id: 'linkedin', name: 'LinkedIn', Icon: Linkedin, enabled: true },
  { id: 'facebook', name: 'Facebook', Icon: Facebook, enabled: false },
  { id: 'instagram', name: 'Instagram', Icon: Instagram, enabled: false }
]

interface StepConnectLinkedInProps {
  onNext: (data?: Record<string, unknown>) => Promise<void>
}

export function StepConnectLinkedIn({ onNext }: StepConnectLinkedInProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    if (!email || !password) {
      setError('Email et mot de passe requis')
      return
    }
    if (!acceptedTerms) {
      setError('Accepte les conditions pour continuer')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/onboarding/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          username: email,
          password
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Connexion échouée')
        return
      }

      if (data.status === 'checkpoint') {
        sessionStorage.setItem(
          'linkedin_onboarding',
          JSON.stringify({
            accountId: data.accountId,
            checkpointType: data.checkpointType
          })
        )
        await onNext({
          linkedinEmail: email,
          unipileAccountId: data.accountId
        })
      } else if (data.status === 'connected') {
        sessionStorage.setItem(
          'linkedin_onboarding',
          JSON.stringify({ accountId: data.accountId, connected: true })
        )
        await onNext({
          linkedinConnected: true,
          linkedinEmail: email,
          unipileAccountId: data.accountId,
          onboardingStep: 2
        })
      }
    } catch (err) {
      setError('Erreur de connexion. Réessaie.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Connecte tes réseaux</h1>
        <p className="text-muted-foreground mt-2">
          Associe ton compte LinkedIn pour débloquer la recherche de profils,
          d&apos;offres et l&apos;envoi de messages.
        </p>
      </div>

      {/* Social network cards */}
      <div className="grid grid-cols-3 gap-3">
        {SOCIALS.map(social => (
          <div
            key={social.id}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors',
              social.enabled
                ? 'border-primary bg-primary/5'
                : 'opacity-40 cursor-not-allowed'
            )}
          >
            <social.Icon
              className={cn(
                'size-8',
                social.enabled ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <span className="text-xs font-medium">{social.name}</span>
            {!social.enabled && (
              <span className="text-[10px] text-muted-foreground">
                Bientôt
              </span>
            )}
          </div>
        ))}
      </div>

      {/* LinkedIn credentials */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-3.5" />
          <span>
            Tes identifiants sont transmis de manière sécurisée et ne sont
            jamais stockés.
          </span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="linkedin-email">Email LinkedIn</Label>
            <Input
              id="linkedin-email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="linkedin-password">Mot de passe</Label>
            <PasswordInput
              id="linkedin-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="flex items-start gap-2">
        <Checkbox
          id="terms"
          checked={acceptedTerms}
          onCheckedChange={checked => setAcceptedTerms(!!checked)}
          disabled={isLoading}
        />
        <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed">
          J&apos;accepte les{' '}
          <a href="#" className="underline">
            conditions d&apos;utilisation
          </a>{' '}
          et la{' '}
          <a href="#" className="underline">
            politique de confidentialité
          </a>
          . Mes identifiants LinkedIn sont utilisés uniquement pour
          l&apos;authentification via Unipile.
        </label>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button
        className="w-full gap-2"
        size="lg"
        onClick={handleConnect}
        disabled={isLoading || !email || !password || !acceptedTerms}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Connexion en cours...
          </>
        ) : (
          <>
            <Linkedin className="size-4" />
            Associer mon compte LinkedIn
          </>
        )}
      </Button>
    </div>
  )
}
