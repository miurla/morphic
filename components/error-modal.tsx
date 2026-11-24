'use client'

import Link from 'next/link'

import {
  IconAlertCircle as AlertCircle,
  IconClock as Clock,
  IconRefresh as RefreshCw
} from '@tabler/icons-react'

import { localizeErrorMessage } from '@/lib/i18n/errors'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

import { useI18n } from '@/components/language-provider'

interface ErrorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  error: {
    type: 'rate-limit' | 'auth' | 'forbidden' | 'general'
    message: string
    details?: string
  }
  onRetry?: () => void
  onAuthClose?: () => void
}

export function ErrorModal({
  open,
  onOpenChange,
  error,
  onRetry,
  onAuthClose
}: ErrorModalProps) {
  const { t, locale } = useI18n()

  const handleAuthClose = () => {
    onOpenChange(false)
    onAuthClose?.()
  }

  const getErrorIcon = () => {
    switch (error.type) {
      case 'rate-limit':
        return <Clock className="size-6 text-yellow-500" />
      case 'auth':
      case 'forbidden':
        return <AlertCircle className="size-6 text-red-500" />
      default:
        return <AlertCircle className="size-6 text-orange-500" />
    }
  }

  const getErrorTitle = () => {
    switch (error.type) {
      case 'rate-limit':
        return t('Rate Limit Exceeded')
      case 'auth':
        return t('Continue with Morphic')
      case 'forbidden':
        return t('Access Denied')
      default:
        return t('Error Occurred')
    }
  }

  const getErrorDescription = () => {
    switch (error.type) {
      case 'rate-limit':
        return (
          (error.message ? localizeErrorMessage(locale, error.message) : '') ||
          t(
            'You have made too many requests. Please wait a moment before trying again.'
          )
        )
      case 'auth':
        return (
          (error.message ? localizeErrorMessage(locale, error.message) : '') ||
          t('To use Morphic, sign in to your account or create a new one.')
        )
      case 'forbidden':
        return t('You do not have permission to access this resource.')
      default:
        return (
          (error.message ? localizeErrorMessage(locale, error.message) : '') ||
          t('An unexpected error occurred. Please try again.')
        )
    }
  }

  const getErrorDetails = () => {
    if (error.type === 'rate-limit') {
      return (
        (error.details ? localizeErrorMessage(locale, error.details) : '') ||
        t('The limit resets at midnight UTC.')
      )
    }
    return error.details
      ? localizeErrorMessage(locale, error.details)
      : undefined
  }

  return (
    <Dialog
      open={open}
      onOpenChange={open => {
        if (!open && error.type === 'auth') {
          handleAuthClose()
        } else {
          onOpenChange(open)
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            {getErrorIcon()}
          </div>
          <DialogTitle className="text-center text-xl font-semibold">
            {getErrorTitle()}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {getErrorDescription()}
          </DialogDescription>
          {getErrorDetails() && (
            <div className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {getErrorDetails()}
            </div>
          )}
        </DialogHeader>
        <DialogFooter className="flex-col gap-2">
          {error.type === 'auth' ? (
            <>
              <Button asChild className="w-full">
                <Link href="/auth/sign-up">{t('Sign Up')}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/login">{t('Sign In')}</Link>
              </Button>
            </>
          ) : (
            <>
              {onRetry && error.type !== 'rate-limit' && (
                <Button
                  onClick={() => {
                    onRetry()
                    onOpenChange(false)
                  }}
                  className="w-full"
                >
                  <RefreshCw className="mr-2 size-4" />
                  {t('Try Again')}
                </Button>
              )}
              <Button
                variant={
                  onRetry && error.type !== 'rate-limit' ? 'outline' : 'default'
                }
                onClick={() => onOpenChange(false)}
                className="w-full"
              >
                {error.type === 'rate-limit' ? t('Understood') : t('Close')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
