'use client'

import type { NormalizedSource } from '@/lib/sources/source-types'

import { SourceCard } from './source-card'

interface SourceCardListProps {
  sources: NormalizedSource[]
  maxSources?: number
}

export function SourceCardList({
  sources,
  maxSources = 6
}: SourceCardListProps) {
  const visibleSources = sources.slice(0, maxSources)

  if (visibleSources.length === 0) {
    return null
  }

  return (
    <section aria-label="Sources" className="w-full space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Sources</h2>
        {sources.length > visibleSources.length ? (
          <span className="text-xs text-muted-foreground">
            Showing {visibleSources.length} of {sources.length}
          </span>
        ) : null}
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visibleSources.map(source => (
          <SourceCard key={source.id} source={source} compact />
        ))}
      </div>
    </section>
  )
}
