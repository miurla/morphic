'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type ProcessHeaderProps = {
  label: ReactNode
  meta?: ReactNode
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
      <div className="min-w-0 max-w-full flex-1 overflow-hidden">{label}</div>
      {meta ? (
        <span className="shrink-0 ml-2 text-xs text-muted-foreground flex items-center gap-1">
          {meta}
        </span>
      ) : null}
    </button>
  )
}

export default ProcessHeader
