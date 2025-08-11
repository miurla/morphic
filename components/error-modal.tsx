'use client'

import { AlertCircle, Clock, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

interface ErrorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  error: {
    type: 'rate-limit' | 'auth' | 'forbidden' | 'general'
    message: string
    details?: string
  }
  onRetry?: () => void
}

export function ErrorModal({
  open,
  onOpenChange,
  error,
  onRetry
}: ErrorModalProps) {
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
        return 'Rate Limit Exceeded'
      case 'auth':
        return 'Authentication Required'
      case 'forbidden':
        return 'Access Denied'
      default:
        return 'Error Occurred'
    }
  }

  const getErrorDescription = () => {
    switch (error.type) {
      case 'rate-limit':
        return 'You have made too many requests. Please wait a moment before trying again.'
      case 'auth':
        return 'You need to sign in to continue using this feature.'
      case 'forbidden':
        return 'You do not have permission to access this resource.'
      default:
        return (
          error.message || 'An unexpected error occurred. Please try again.'
        )
    }
  }

  const getErrorDetails = () => {
    if (error.type === 'rate-limit') {
      return 'Our rate limiting helps ensure fair usage and maintain service quality for all users. The limit will reset shortly.'
    }
    return error.details
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {onRetry && error.type !== 'rate-limit' && (
            <Button
              onClick={() => {
                onRetry()
                onOpenChange(false)
              }}
              className="w-full"
            >
              <RefreshCw className="mr-2 size-4" />
              Try Again
            </Button>
          )}
          <Button
            variant={
              onRetry && error.type !== 'rate-limit' ? 'outline' : 'default'
            }
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            {error.type === 'rate-limit' ? 'Understood' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
