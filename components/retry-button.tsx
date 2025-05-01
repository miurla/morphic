'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from './ui/button'

interface RetryButtonProps {
  reload: () => Promise<string | null | undefined>
  messageId: string
}

export const RetryButton: React.FC<RetryButtonProps> = ({
  reload,
  messageId
}) => {
  return (
    <Button
      className="rounded-full h-8 w-8"
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => reload()}
      aria-label={`Retry from message ${messageId}`}
    >
      <RotateCcw className="w-4 h-4" />
      <span className="sr-only">Retry</span>
    </Button>
  )
}
