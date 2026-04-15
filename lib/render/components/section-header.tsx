'use client'

import type { ComponentFn } from '@json-render/react'
import { Repeat2 } from 'lucide-react'

import type { CatalogType } from './shared'

const iconMap = {
  related: Repeat2
} as const

export const SectionHeader: ComponentFn<CatalogType, 'SectionHeader'> = ({
  props
}) => {
  const Icon = props.icon ? iconMap[props.icon] : null
  return (
    <div className="flex items-center gap-2 text-lg font-bold text-foreground">
      {Icon && <Icon className="size-5" />}
      {props.title}
    </div>
  )
}
