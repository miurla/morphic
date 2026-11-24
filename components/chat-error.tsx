'use client'

import { IconAlertCircle as AlertCircle } from '@tabler/icons-react'

import { toPublicErrorPayload } from '@/lib/errors/public-error'
import { localizePublicError } from '@/lib/i18n/errors'

import { Card } from '@/components/ui/card'

import { useI18n } from '@/components/language-provider'

interface ChatErrorProps {
  error: Error | string | null | undefined
}

export function ChatError({ error }: ChatErrorProps) {
  const { locale } = useI18n()
  if (!error) return null

  const errorMessage = localizePublicError(
    toPublicErrorPayload(error),
    locale
  ).error

  return (
    <Card className="border-destructive bg-destructive/10 p-4">
      <div className="flex items-center gap-3">
        <AlertCircle className="size-5 text-destructive shrink-0" />
        <p className="text-sm text-destructive">{errorMessage}</p>
      </div>
    </Card>
  )
}
