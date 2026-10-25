'use client'

import type { ComponentFn } from '@json-render/react'

import { cn } from '@/lib/utils'

import type { CatalogType } from './shared'

export const Text: ComponentFn<CatalogType, 'Text'> = ({ props }) => {
  const { text, tone = 'default', weight = 'normal' } = props
  return (
    <span
      className={cn(
        tone === 'muted'
          ? 'text-xs text-muted-foreground line-clamp-3'
          : 'text-sm leading-snug text-foreground line-clamp-2',
        weight === 'semibold' && 'font-medium'
      )}
    >
      {text}
    </span>
  )
}
