'use client'

import { IconRefresh as RotateCcw } from '@tabler/icons-react'

import { useI18n } from '@/components/language-provider'

import { Button } from './ui/button'

interface RetryButtonProps {
  reload: () => Promise<void | string | null | undefined>
  messageId: string
}

export const RetryButton: React.FC<RetryButtonProps> = ({
  reload,
  messageId
}) => {
  const { t } = useI18n()

  return (
    <Button
      className="rounded-full size-8"
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => reload()}
      aria-label={t('Retry from message {id}', { id: messageId })}
    >
      <RotateCcw className="size-4" />
      <span className="sr-only">{t('Retry')}</span>
    </Button>
  )
}
