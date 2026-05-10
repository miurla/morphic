'use client'

import { useState } from 'react'

import {
  ArrowLeft,
  Check,
  Loader2,
  MessageCircle,
  Send,
  SkipForward
} from 'lucide-react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

interface StepWhatsappProps {
  onNext: (data?: Record<string, unknown>) => Promise<void>
  onSkip: () => Promise<void>
  onBack: () => void
}

export function StepWhatsapp({ onNext, onSkip, onBack }: StepWhatsappProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [testSent, setTestSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleTestSend = async () => {
    if (!phoneNumber.trim()) {
      setError('Entre ton numéro WhatsApp')
      return
    }

    setIsSending(true)
    setError(null)

    try {
      const res = await fetch('/api/onboarding/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          phoneNumber: phoneNumber.replace(/[^0-9+]/g, '')
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Échec de l'envoi")
        return
      }

      setTestSent(true)
    } catch {
      setError('Erreur de connexion. Réessaie.')
    } finally {
      setIsSending(false)
    }
  }

  const handleContinue = async () => {
    setIsSaving(true)
    await onNext({
      whatsappNumber: phoneNumber.replace(/[^0-9+]/g, ''),
      whatsappEnabled: true
    })
    setIsSaving(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Notifications WhatsApp</h1>
        <p className="text-muted-foreground mt-2">
          Reçois les résultats de tes recherches et les alertes Heartbeat
          directement sur WhatsApp.
        </p>
      </div>

      {/* WhatsApp icon */}
      <div className="flex justify-center">
        <div className="size-20 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <MessageCircle className="size-10 text-green-500" />
        </div>
      </div>

      {/* Phone number */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp-phone">Numéro WhatsApp</Label>
          <Input
            id="whatsapp-phone"
            type="tel"
            placeholder="+33 6 12 34 56 78"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            disabled={isSending || isSaving}
          />
          <p className="text-xs text-muted-foreground">
            Avec l&apos;indicatif pays (ex: +33 pour la France)
          </p>
        </div>
      </div>

      {/* Test send */}
      {!testSent ? (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleTestSend}
          disabled={isSending || !phoneNumber.trim()}
        >
          {isSending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Send className="size-4" />
              Tester l&apos;envoi
            </>
          )}
        </Button>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-600">
          <Check className="size-4 shrink-0" />
          Message envoyé ! Vérifie ton WhatsApp.
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button
          className="w-full"
          size="lg"
          onClick={handleContinue}
          disabled={isSaving || !phoneNumber.trim()}
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            'Continuer'
          )}
        </Button>
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour
          </button>
          <button
            onClick={onSkip}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Passer cette étape
            <SkipForward className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
