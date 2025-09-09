'use client'

import { cn } from '@/lib/utils'

export type ProcessHeaderProps = {
  label: React.ReactNode
  meta?: React.ReactNode
  onInspect?: () => void
  isLoading?: boolean
  ariaExpanded?: boolean
  className?: string
}

export function ProcessHeader({
  label,
  meta,
  onInspect,
  isLoading,
  ariaExpanded,
  className
}: ProcessHeaderProps) {
  return (
    <button
      type="button"
      onClick={onInspect}
      aria-expanded={ariaExpanded}
      className={cn(
        'flex items-center justify-between w-full min-w-0 text-left text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer',
        isLoading && 'animate-pulse',
        className
      )}
    >
      <span className="min-w-0 max-w-full truncate">{label}</span>
      {meta ? (
        <span className="shrink-0 ml-2 text-xs text-muted-foreground flex items-center gap-1">
          {meta}
        </span>
      ) : null}
    </button>
  )}

export default ProcessHeader

