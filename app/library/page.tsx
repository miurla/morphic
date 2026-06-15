import Link from 'next/link'

import { listReadingItems } from '@/lib/actions/reading-items'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { buildReaderUrl } from '@/lib/sources/reader'

import { GuardedExternalLink } from '@/components/navigation/guarded-external-link'

export const metadata = {
  title: 'Library — Morphic',
  description: 'Saved sources and reading queue.'
}

function formatDate(value?: Date | string | null) {
  if (!value) {
    return undefined
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export default async function LibraryPage() {
  const userId = await getCurrentUserId()

  if (!userId) {
    return (
      <div className="h-full w-full overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to save and view sources.
          </p>
          <Link href="/auth/login" className="text-sm font-medium underline">
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  const result = await listReadingItems(userId)
  const items = result.success ? result.items : []

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="text-sm text-muted-foreground">
            Saved sources for later reading.
          </p>
        </div>

        {!result.success ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Failed to load saved sources.
          </p>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
            Saved sources will appear here.
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {items.map(item => {
              const date = formatDate(item.publishedAt || item.createdAt)
              return (
                <article key={item.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{item.siteName || item.domain || 'Source'}</span>
                    <span>{item.status}</span>
                    {date ? <span>{date}</span> : null}
                  </div>
                  <h2 className="text-base font-medium leading-snug">
                    {item.title}
                  </h2>
                  {item.summary ? (
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {item.summary}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={buildReaderUrl({
                        url: item.url,
                        title: item.title,
                        siteName: item.siteName,
                        sourceId: item.sourceId
                      })}
                      className="inline-flex text-sm font-medium underline underline-offset-4"
                    >
                      Reader
                    </Link>
                    <GuardedExternalLink
                      href={item.url}
                      className="inline-flex text-sm font-medium underline underline-offset-4"
                    >
                      Read original
                    </GuardedExternalLink>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
