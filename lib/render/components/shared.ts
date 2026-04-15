import { ArrowRight, Repeat2 } from 'lucide-react'

import { catalog } from '../catalog'

export type CatalogType = typeof catalog

export const stackGap = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4'
} as const

/**
 * Icons available to any spec component that accepts an `icon` prop
 * (Heading, Button, etc). Keep this small and curated.
 */
export const iconMap = {
  related: Repeat2,
  'arrow-right': ArrowRight
} as const

export type IconName = keyof typeof iconMap
