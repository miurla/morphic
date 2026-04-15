'use client'

import type { ComponentFn } from '@json-render/react'
import { ArrowRight } from 'lucide-react'

import type { CatalogType } from './shared'

export const QuestionButton: ComponentFn<CatalogType, 'QuestionButton'> = ({
  props,
  on
}) => {
  const handle = on('press')
  return (
    <div className="flex items-center w-fit">
      <ArrowRight className="h-4 w-4 mr-2 shrink-0 text-accent-foreground/50" />
      <button
        type="button"
        onClick={handle.emit}
        className="flex-1 justify-start px-0 py-0.5 h-fit font-semibold text-accent-foreground/50 whitespace-normal text-left hover:text-accent-foreground/70 transition-colors cursor-pointer"
      >
        {props.text}
      </button>
    </div>
  )
}
