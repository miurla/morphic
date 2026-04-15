import { catalog } from '../catalog'

export type CatalogType = typeof catalog

export const stackGap = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4'
} as const
