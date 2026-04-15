'use client'

import type { ComponentFn } from '@json-render/react'

import { cn } from '@/lib/utils'

import { type CatalogType, stackGap } from './shared'

export const Stack: ComponentFn<CatalogType, 'Stack'> = ({
  props,
  children
}) => {
  const { direction = 'vertical', gap = 'md' } = props
  return (
    <div
      className={cn(
        'flex',
        direction === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col',
        stackGap[gap]
      )}
    >
      {children}
    </div>
  )
}
