'use client'

import { RotateCcw } from 'lucide-react'

import { Button } from './ui/button'

interface RetryButtonProps {
  reload: () => Promise<void | string | null | undefined>
  messageId: string
}

export const RetryButton: React.FC<RetryButtonProps> = ({
  reload,
  messageId
}) => {
  return (
    <Button
      className="rounded-full size-8"
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => reload()}
      aria-label={`Retry from message ${messageId}`}
    >
      <RotateCcw className="size-4" />
      <span className="sr-only">Retry</span>
    </Button>
  )
}
