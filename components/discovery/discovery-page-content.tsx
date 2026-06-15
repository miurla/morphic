import type { DiscoveryPageData } from '@/lib/discovery/discovery'

import { GistModule } from '@/components/gist/gist-module'
import { GuardedExternalLink } from '@/components/navigation/guarded-external-link'

interface DiscoveryPageContentProps {
  data: DiscoveryPageData
}

function formatGeneratedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  })
}

function formatSourceMeta(sourceCount: number) {
  return sourceCount === 1 ? '1 source' : `${sourceCount} sources`
}

function formatFeedErrorCount(count: number) {
  return count === 1
    ? '1 feed could not be read.'
    : `${count} feeds could not be read.`
}

export function DiscoveryPageContent({ data }: DiscoveryPageContentProps) {
  const generatedAt = formatGeneratedAt(data.generatedAt)
  const categories = Array.from(
    new Set(data.clusters.map(cluster => cluster.category))
  )

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Discovery</h1>
            {generatedAt ? (
              <span className="text-xs text-muted-foreground">
                Updated {generatedAt}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Source-backed stories from configured feeds.
          </p>
        </div>

        {data.feedErrors.length > 0 ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            {formatFeedErrorCount(data.feedErrors.length)}
          </p>
        ) : null}

        <GistModule sources={data.sources} />

        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" aria-label="Categories">
            {categories.map(category => (
              <span
                key={category}
                className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground"
              >
                {category}
              </span>
            ))}
          </div>
        ) : null}

        {data.clusters.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
            No configured feed items yet.
          </div>
        ) : (
          <section className="space-y-2" data-testid="story-clusters">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-foreground">
                Trending links
              </h2>
              <span className="text-xs text-muted-foreground">
                {data.clusters.length} stories
              </span>
            </div>

            <div className="grid gap-2 lg:grid-cols-2">
              {data.clusters.map(cluster => (
                <article
                  key={cluster.id}
                  aria-label={cluster.title}
                  className="flex min-w-0 flex-col gap-3 rounded-md border bg-card p-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{cluster.category}</span>
                      <span>{formatSourceMeta(cluster.sourceCount)}</span>
                    </div>
                    <h3 className="text-base font-medium leading-snug text-foreground">
                      {cluster.title}
                    </h3>
                    {cluster.summary ? (
                      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {cluster.summary}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    {cluster.sources.map(source =>
                      source.url ? (
                        <GuardedExternalLink
                          key={source.id}
                          href={source.url}
                          target="_blank"
                          className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {source.title}
                        </GuardedExternalLink>
                      ) : null
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
