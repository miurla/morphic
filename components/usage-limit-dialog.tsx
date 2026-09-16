'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

import { formatUsageRenewal } from '@/components/usage-dialog'

interface UsageLimitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resetAt?: string
}

export function UsageLimitDialog({
  open,
  onOpenChange,
  resetAt
}: UsageLimitDialogProps) {
  const [interestRecorded, setInterestRecorded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open) {
      setInterestRecorded(false)
      setSubmitting(false)
      setError(false)
    }
  }, [open])

  const recordInterest = async () => {
    setSubmitting(true)
    setError(false)

    try {
      const response = await fetch('/api/usage/interest', { method: 'POST' })
      if (!response.ok) throw new Error('Request failed')
      setInterestRecorded(true)
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  const resetCopy = resetAt
    ? `${formatUsageRenewal(resetAt).replace(/^Renews /, 'Your usage renews on ')}.`
    : 'Your usage will renew at the start of your next monthly period.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{"You've reached your monthly usage limit"}</DialogTitle>
          <DialogDescription>{resetCopy}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {"Additional usage isn't available yet."}
        </p>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {"Couldn't record your request. Please try again."}
          </p>
        )}

        <DialogFooter>
          <Button
            onClick={recordInterest}
            disabled={submitting || interestRecorded}
          >
            {interestRecorded
              ? 'Recorded'
              : submitting
                ? 'Recording…'
                : 'I need more usage'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
