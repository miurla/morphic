'use client'

import type { ComponentFn } from '@json-render/react'
import { defineRegistry } from '@json-render/react'
import { ArrowRight, Repeat2 } from 'lucide-react'

import { cn } from '@/lib/utils'

import { catalog } from './catalog'

type CatalogType = typeof catalog

const iconMap = {
  related: Repeat2
} as const

const SectionHeader: ComponentFn<CatalogType, 'SectionHeader'> = ({
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

const stackGap = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4'
}

const Stack: ComponentFn<CatalogType, 'Stack'> = ({ props, children }) => {
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

const QuestionButton: ComponentFn<CatalogType, 'QuestionButton'> = ({
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

export const { registry } = defineRegistry(catalog, {
  components: {
    SectionHeader,
    Stack,
    QuestionButton
  },
  actions: {
    submitQuery: async () => {
      // Handled by ActionProvider at runtime
    }
  }
})
