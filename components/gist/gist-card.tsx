import type { NormalizedSource } from '@/lib/sources/source-types'

import { GuardedExternalLink } from '@/components/navigation/guarded-external-link'

import { GistCardSourceChips } from './gist-card-source-chips'
import type { GistCardData } from './gist-module'

interface GistCardProps {
  card: GistCardData
  sourcesById: Map<string, NormalizedSource>
}

export function GistCard({ card, sourcesById }: GistCardProps) {
  const mediaUrls = card.mediaUrls?.length
    ? card.mediaUrls
    : card.mediaUrl
      ? [card.mediaUrl]
      : []
  const isSummary = card.type === 'summary'

  return (
    <article
      className="flex min-h-[172px] flex-col justify-between gap-3 rounded-md border bg-card p-3 text-sm"
      data-testid={`gist-card-${card.type}`}
    >
      <div className="min-w-0 space-y-2">
        {mediaUrls.length > 0 ? (
          <div
            className={
              mediaUrls.length === 1
                ? 'overflow-hidden rounded'
                : 'grid grid-cols-3 gap-2'
            }
          >
            {mediaUrls.map((url, index) => (
              <img
                key={`${url}-${index}`}
                src={url}
                alt=""
                className={
                  mediaUrls.length === 1
                    ? 'h-36 w-full object-cover'
                    : 'h-24 w-full rounded object-cover'
                }
                loading="lazy"
              />
            ))}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase text-muted-foreground">
            {card.eyebrow}
          </p>
          <h2 className="text-base font-semibold leading-snug text-foreground">
            {card.title}
          </h2>
          <p
            className={
              isSummary
                ? 'text-sm leading-7 text-foreground/85'
                : 'line-clamp-4 text-xs leading-relaxed text-muted-foreground'
            }
          >
            {card.body}
          </p>
        </div>
      </div>

      {card.type === 'read-originals' ? (
        <div className="space-y-1.5">
          {card.sourceIds.map(sourceId => {
            const source = sourcesById.get(sourceId)
            if (!source?.url) {
              return null
            }

            return (
              <GuardedExternalLink
                key={sourceId}
                href={source.url}
                target="_blank"
                className="block truncate text-xs font-medium text-foreground underline-offset-4 hover:underline"
              >
                {source.title}
              </GuardedExternalLink>
            )
          })}
        </div>
      ) : (
        <GistCardSourceChips
          sourceIds={card.sourceIds}
          sourcesById={sourcesById}
        />
      )}
    </article>
  )
}
