'use client'

import type { ComponentFn } from '@json-render/react'

import { cn } from '@/lib/utils'

import { Button as UIButton } from '@/components/ui/button'

import { type CatalogType, iconMap } from './shared'

/**
 * Generic button spec component. Renders the project's shadcn Button and
 * emits a `press` action on click. Use variant="link" with an arrow icon
 * for inline follow-up suggestions (the former QuestionButton look).
 */
export const Button: ComponentFn<CatalogType, 'Button'> = ({ props, on }) => {
  const { text, icon, variant = 'link' } = props
  const Icon = icon ? iconMap[icon] : null
  const handle = on('press')

  // For the link variant, tweak layout/color so it reads as an inline
  // follow-up suggestion: muted color, left-aligned, wrappable text and
  // zero padding. The shadcn link variant's hover underline is preserved.
  const linkOverride =
    variant === 'link'
      ? 'h-auto w-fit justify-start whitespace-normal text-left px-0 py-0.5 font-semibold text-accent-foreground/50 hover:text-accent-foreground/70'
      : ''

  return (
    <UIButton
      variant={variant}
      onClick={handle.emit}
      className={cn('gap-2', linkOverride)}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      {text}
    </UIButton>
  )
}
