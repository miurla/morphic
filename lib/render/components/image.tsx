/* eslint-disable @next/next/no-img-element */
'use client'

import { useState } from 'react'

import type { ComponentFn } from '@json-render/react'

import { cn } from '@/lib/utils'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

import { ImageCreditOverlay } from '@/components/image-credit-overlay'

import type { CatalogType } from './shared'

const aspectRatioClass = {
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]'
} as const

export const Image: ComponentFn<CatalogType, 'Image'> = ({ props }) => {
  const { src, sourceUrl, title, description, aspectRatio = '4:3' } = props
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
