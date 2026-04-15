'use client'

import type { ComponentFn } from '@json-render/react'

import { cn } from '@/lib/utils'

import { type CatalogType, stackGap } from './shared'

const gridCols = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4'
} as const

export const Grid: ComponentFn<CatalogType, 'Grid'> = ({ props, children }) => {
  const { columns, gap = 'sm' } = props
  return (
    <div className={cn('grid w-full', gridCols[columns], stackGap[gap])}>
      {children}
    </div>
  )
}
