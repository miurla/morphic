'use client'

import type { Locale } from '@/lib/i18n/config'
import { translate } from '@/lib/i18n/translate'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

import { useI18n } from '@/components/language-provider'
import type { UsageBudget } from '@/components/usage-budget-provider'

interface UsageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  usage: UsageBudget
}

export function formatUsageRenewal(
  resetAt: string,
  locale: Locale = 'en',
  message = 'Renews {date}'
) {
  const date = new Date(resetAt)
  if (Number.isNaN(date.getTime()))
    return translate(locale, 'Renewal date unavailable')

  return translate(locale, message, {
    date: new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date)
  })
}

export function UsageDialog({ open, onOpenChange, usage }: UsageDialogProps) {
  const { t, locale } = useI18n()
  const percentage =
    usage.limit > 0
      ? Math.min(100, Math.max(0, (usage.remaining / usage.limit) * 100))
      : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Monthly usage')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('Your remaining monthly usage and renewal date.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {t('{remaining} of {limit} remaining', {
                remaining: usage.remaining.toLocaleString(locale),
                limit: usage.limit.toLocaleString(locale)
              })}
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={t('Monthly usage remaining')}
              aria-valuemin={0}
              aria-valuemax={Math.max(0, usage.limit)}
              aria-valuenow={Math.max(0, usage.remaining)}
            >
              <div
                className="h-full rounded-full bg-primary transition-transform duration-200 ease-out motion-reduce:transition-none"
                style={{
                  width: '100%',
                  transform: `translateX(-${100 - percentage}%)`
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {formatUsageRenewal(usage.resetAt, locale)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                'Usage renews monthly based on when your account was created.'
              )}
            </p>
          </div>

          <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-4 py-1">
              <span>{t('Quick')}</span>
              <span className="text-muted-foreground tabular-nums">
                {t('{count} per message', {
                  count: (usage.costs?.quick ?? 1).toLocaleString(locale)
                })}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-1">
              <span>{t('Adaptive')}</span>
              <span className="text-muted-foreground tabular-nums">
                {t('{count} per message', {
                  count: (usage.costs?.adaptive ?? 2).toLocaleString(locale)
                })}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
