'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

import type { UsageBudget } from '@/components/usage-budget-provider'

interface UsageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  usage: UsageBudget
}

export function formatUsageRenewal(resetAt: string) {
  const date = new Date(resetAt)
  if (Number.isNaN(date.getTime())) return 'Renewal date unavailable'

  return `Renews ${new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)}`
}

export function UsageDialog({ open, onOpenChange, usage }: UsageDialogProps) {
  const percentage =
    usage.limit > 0
      ? Math.min(100, Math.max(0, (usage.remaining / usage.limit) * 100))
      : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Monthly usage</DialogTitle>
          <DialogDescription className="sr-only">
            Your remaining monthly usage and renewal date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {usage.remaining} of {usage.limit} remaining
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Monthly usage remaining"
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
              {formatUsageRenewal(usage.resetAt)}
            </p>
            <p className="text-sm text-muted-foreground">
              Usage renews monthly based on when your account was created.
            </p>
          </div>

          <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-4 py-1">
              <span>Quick</span>
              <span className="text-muted-foreground tabular-nums">
                {usage.costs?.quick ?? 1} per message
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-1">
              <span>Adaptive</span>
              <span className="text-muted-foreground tabular-nums">
                {usage.costs?.adaptive ?? 2} per message
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
