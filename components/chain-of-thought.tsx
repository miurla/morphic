'use client'

import { useState } from 'react'

import { Check, ChevronRight, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from './ui/collapsible'

// ── Chain container ──────────────────────────────────

interface ChainOfThoughtProps {
  children: React.ReactNode
  className?: string
}

export function ChainOfThought({ children, className }: ChainOfThoughtProps) {
  return (
    <div className={cn('relative space-y-0', className)}>{children}</div>
  )
}

// ── Step ─────────────────────────────────────────────

interface ChainOfThoughtStepProps {
  children: React.ReactNode
  className?: string
  isLast?: boolean
  defaultOpen?: boolean
}

export function ChainOfThoughtStep({
  children,
  className,
  isLast = false,
  defaultOpen = false
}: ChainOfThoughtStepProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        {/* Vertical connector line */}
        {!isLast && (
          <div className="absolute left-[11px] top-[28px] bottom-0 w-px bg-border" />
        )}
        {children}
      </div>
    </Collapsible>
  )
}

// ── Step trigger (header) ────────────────────────────

interface ChainOfThoughtTriggerProps {
  children: React.ReactNode
  icon?: React.ReactNode
  status?: 'loading' | 'complete' | 'error'
  className?: string
}

export function ChainOfThoughtTrigger({
  children,
  icon,
  status = 'complete',
  className
}: ChainOfThoughtTriggerProps) {
  return (
    <CollapsibleTrigger
      className={cn(
        'flex items-center gap-2.5 w-full py-1.5 text-left group',
        className
      )}
    >
      {/* Status dot */}
      <div
        className={cn(
          'relative z-10 flex items-center justify-center size-[22px] rounded-full border-2 shrink-0 transition-colors',
          status === 'complete' &&
            'border-green-500 bg-green-500 text-white',
          status === 'loading' &&
            'border-primary bg-background text-primary',
          status === 'error' &&
            'border-destructive bg-destructive text-white'
        )}
      >
        {status === 'loading' ? (
          <Loader2 className="size-3 animate-spin" />
        ) : icon ? (
          <span className="size-3 [&>svg]:size-3">{icon}</span>
        ) : (
          <Check className="size-3" />
        )}
      </div>

      {/* Label */}
      <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors flex-1">
        {children}
      </span>

      {/* Chevron */}
      <ChevronRight className="size-3.5 text-muted-foreground/50 transition-transform group-data-[state=open]:rotate-90" />
    </CollapsibleTrigger>
  )
}

// ── Step content ─────────────────────────────────────

interface ChainOfThoughtContentProps {
  children: React.ReactNode
  className?: string
}

export function ChainOfThoughtContent({
  children,
  className
}: ChainOfThoughtContentProps) {
  return (
    <CollapsibleContent>
      <div className={cn('ml-[30px] pb-3 pt-1', className)}>{children}</div>
    </CollapsibleContent>
  )
}
