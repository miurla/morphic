'use client'

import { useEffect, useRef, useState } from 'react'

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Smartphone
} from 'lucide-react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface StepOtpVerificationProps {
  onNext: (data?: Record<string, unknown>) => Promise<void>
  onBack: () => void
}

export function StepOtpVerification({
  onNext,
  onBack
}: StepOtpVerificationProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [checkpointType, setCheckpointType] = useState('OTP')
  const [accountId, setAccountId] = useState<string | null>(null)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('linkedin_onboarding')
    if (stored) {
      const data = JSON.parse(stored)
      setAccountId(data.accountId)
      setCheckpointType(data.checkpointType || 'OTP')

      if (data.checkpointType === 'IN_APP_VALIDATION') {
        setIsPolling(true)
        startPolling(data.accountId)
      }
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  const startPolling = (accId: string) => {
    let attempts = 0
    pollTimerRef.current = setInterval(async () => {
      attempts++
      if (attempts > 40) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current)
        setIsPolling(false)
        setError('Délai dépassé. Réessaie.')
        return
      }

      try {
        const res = await fetch('/api/onboarding/linkedin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'poll', accountId: accId })
        })
        const data = await res.json()
        if (data.status === 'connected') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current)
          setIsPolling(false)
          await onNext({ linkedinConnected: true })
        }
      } catch {}
    }, 3000)
  }

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1]
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newCode = [...code]
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    setCode(newCode)
    const nextEmpty = pasted.length < 6 ? pasted.length : 5
    inputRefs.current[nextEmpty]?.focus()
  }

  const handleVerify = async () => {
    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      setError('Entre les 6 chiffres du code')
      return
    }
    if (!accountId) {
      setError('Session expirée. Retourne en arrière et reconnecte-toi.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/onboarding/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkpoint',
          accountId,
          code: fullCode
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Code invalide')
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
        return
      }

      if (data.status === 'checkpoint') {
        setCheckpointType(data.checkpointType)
        if (data.checkpointType === 'IN_APP_VALIDATION') {
          setIsPolling(true)
          startPolling(data.accountId)
        } else {
          setCode(['', '', '', '', '', ''])
          inputRefs.current[0]?.focus()
          setError('Un nouveau code a été envoyé.')
        }
      } else if (data.status === 'connected') {
        await onNext({ linkedinConnected: true })
      }
    } catch {
      setError('Erreur. Réessaie.')
    } finally {
      setIsLoading(false)
    }
  }

  if (checkpointType === 'IN_APP_VALIDATION') {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Approbation requise</h1>
          <p className="text-muted-foreground mt-2">
            Ouvre l&apos;application LinkedIn sur ton téléphone et approuve
            la connexion.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 py-8">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="size-8 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            {isPolling
              ? 'En attente de ton approbation...'
              : 'Délai dépassé. Réessaie.'}
          </p>
          {isPolling && (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Vérification</h1>
        <p className="text-muted-foreground mt-2">
          Entre le code à 6 chiffres envoyé par LinkedIn
          {checkpointType === '2FA'
            ? ' via ton application authenticator'
            : ' par email ou SMS'}
          .
        </p>
      </div>

      {/* OTP Input */}
      <div className="flex justify-center gap-3" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <Input
            key={i}
            ref={el => {
              inputRefs.current[i] = el
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleDigitChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className="size-14 text-center text-2xl font-bold"
            disabled={isLoading}
            autoFocus={i === 0}
          />
        ))}
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <Button
        className="w-full gap-2"
        size="lg"
        onClick={handleVerify}
        disabled={isLoading || code.some(d => !d)}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Vérification...
          </>
        ) : (
          <>
            <CheckCircle2 className="size-4" />
            Vérifier
          </>
        )}
      </Button>

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour
      </button>
    </div>
  )
}
