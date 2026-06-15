import type { NormalizedSource } from '@/lib/sources/source-types'

interface GistCardSourceChipsProps {
  sourceIds: string[]
  sourcesById: Map<string, NormalizedSource>
}

export function GistCardSourceChips({
  sourceIds,
  sourcesById
}: GistCardSourceChipsProps) {
  if (sourceIds.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Gist sources">
      {sourceIds.map(sourceId => {
        const source = sourcesById.get(sourceId)
        const label =
          source?.siteName ||
          source?.domain?.replace(/^www\./, '') ||
          source?.provider ||
          source?.title ||
          'Source'
        return (
          <span
            key={sourceId}
            className="max-w-full rounded-full border bg-background px-2 py-0.5 text-[11px] leading-5 text-muted-foreground"
            title={source?.title || sourceId}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}
