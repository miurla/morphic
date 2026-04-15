/* eslint-disable @next/next/no-img-element */
'use client'

import { useState } from 'react'

import type { ComponentFn } from '@json-render/react'
import { defineRegistry } from '@json-render/react'
import { ArrowRight, Repeat2 } from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

import { ImageCreditOverlay } from '@/components/image-credit-overlay'

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

const gridCols = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4'
} as const

const Grid: ComponentFn<CatalogType, 'Grid'> = ({ props, children }) => {
  const { columns, gap = 'sm' } = props
  return (
    <div className={cn('grid w-full', gridCols[columns], stackGap[gap])}>
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

const aspectRatioClass = {
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]'
} as const

const Image: ComponentFn<CatalogType, 'Image'> = ({ props }) => {
  const {
    src,
    sourceUrl,
    title,
    description,
    aspectRatio = '4:3'
  } = props
  const [errored, setErrored] = useState(false)

  if (!src || errored) {
    return null
  }

  const alt = title || description || 'Image'

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full cursor-pointer overflow-hidden rounded-lg bg-muted',
            aspectRatioClass[aspectRatio]
          )}
        >
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover shadow-sm"
            onError={() => setErrored(true)}
          />
        </button>
      </DialogTrigger>
      <DialogContent className="w-auto max-w-[90vw] border-0 bg-transparent p-0 shadow-none gap-0 sm:max-w-[90vw]">
        <DialogHeader className="sr-only">
          <DialogTitle>{alt}</DialogTitle>
        </DialogHeader>
        <div className="relative inline-block">
          <img
            src={src}
            alt={alt}
            className="block h-auto max-h-[85vh] w-auto max-w-[90vw] rounded-lg"
          />
          <ImageCreditOverlay
            url={src}
            sourceUrl={sourceUrl}
            title={title}
            description={description}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const { registry } = defineRegistry(catalog, {
  components: {
    SectionHeader,
    Stack,
    QuestionButton,
    Grid,
    Image
  },
  actions: {
    submitQuery: async () => {
      // Handled by ActionProvider at runtime
    }
  }
})
