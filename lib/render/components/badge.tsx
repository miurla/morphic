'use client'

import type { ComponentFn } from '@json-render/react'

import type { CatalogType } from './shared'

export const Badge: ComponentFn<CatalogType, 'Badge'> = ({ props }) => {
  return (
    <span className="w-fit rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {props.text}
    </span>
  )
}
