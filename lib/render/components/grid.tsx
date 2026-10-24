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

// Same column counts from the sm breakpoint up, one column below it.
const responsiveGridCols = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-4'
} as const

export const Grid: ComponentFn<CatalogType, 'Grid'> = ({ props, children }) => {
  const { columns, gap = 'sm', responsive = false } = props
  return (
    <div
      className={cn(
        'grid w-full',
        (responsive ? responsiveGridCols : gridCols)[columns],
        stackGap[gap]
      )}
    >
      {children}
    </div>
  )
}
