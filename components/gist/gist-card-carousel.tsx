'use client'

import { useMemo, useRef, useState } from 'react'

import {
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight
} from 'iconoir-react'

import type { NormalizedSource } from '@/lib/sources/source-types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

import { GistCard } from './gist-card'
import type { GistCardData } from './gist-module'

interface GistCardCarouselProps {
  cards: GistCardData[]
  sources: NormalizedSource[]
}

const MIN_SWIPE_DISTANCE = 48

export function GistCardCarousel({ cards, sources }: GistCardCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const sourcesById = useMemo(
    () => new Map(sources.map(source => [source.id, source])),
    [sources]
  )

  if (cards.length === 0) {
    return null
  }

  const activeCard = cards[activeIndex]
  const goTo = (nextIndex: number) => {
    setActiveIndex(Math.max(0, Math.min(cards.length - 1, nextIndex)))
  }
  const goPrevious = () => goTo(activeIndex - 1)
  const goNext = () => goTo(activeIndex + 1)

  return (
    <div
      className="space-y-2"
      data-testid="gist-carousel"
      role="region"
      aria-label="Gist"
      tabIndex={0}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          goPrevious()
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          goNext()
        }
      }}
      onTouchStart={event => {
        touchStartX.current = event.touches[0]?.clientX ?? null
      }}
      onTouchEnd={event => {
        if (touchStartX.current === null) {
          return
        }

        const endX = event.changedTouches[0]?.clientX
        if (typeof endX !== 'number') {
          touchStartX.current = null
          return
        }

        const deltaX = endX - touchStartX.current
        touchStartX.current = null

        if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE) {
          return
        }

        if (deltaX < 0) {
          goNext()
        } else {
          goPrevious()
        }
      }}
    >
      <GistCard card={activeCard} sourcesById={sourcesById} />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" aria-label="Gist progress">
          {cards.map((card, index) => (
            <span
              key={card.id}
              className={cn(
                'size-1.5 rounded-full',
                index === activeIndex
                  ? 'bg-foreground'
                  : 'bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            aria-label="Previous Gist card"
            disabled={activeIndex === 0}
            onClick={goPrevious}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            aria-label="Next Gist card"
            disabled={activeIndex === cards.length - 1}
            onClick={goNext}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
