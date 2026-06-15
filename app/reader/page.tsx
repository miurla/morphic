import Link from 'next/link'

import { buildReaderUrl } from '@/lib/sources/reader'

import { GuardedExternalLink } from '@/components/navigation/guarded-external-link'
import { ReaderView } from '@/components/sources/reader-view'

export const metadata = {
  title: 'Reader — Morphic',
  description: 'Inspect a source while keeping the original visible.'
}

export default function ReaderPage({
  searchParams
}: {
  searchParams: Promise<{
    url?: string
    title?: string
    siteName?: string
    sourceId?: string
  }>
}) {
  return <ReaderPageContent searchParams={searchParams} />
}

async function ReaderPageContent({
  searchParams
}: {
  searchParams: Promise<{
    url?: string
    title?: string
    siteName?: string
    sourceId?: string
  }>
}) {
  const params = await searchParams
  const sourceUrl = params.url

  if (!sourceUrl) {
    return (
      <div className="h-full w-full overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          <Link href="/" className="text-sm font-medium underline">
            Back to search
          </Link>
          <h1 className="text-2xl font-semibold">Reader</h1>
          <p className="text-sm text-muted-foreground">
            Open Reader from a source card or saved library item.
          </p>
        </div>
      </div>
    )
  }

  const readerApiUrl = buildReaderUrl({
    url: sourceUrl,
    title: params.title,
    siteName: params.siteName,
    sourceId: params.sourceId
  }).replace('/reader?', '/api/reader?')

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-medium underline">
            Back to search
          </Link>
          <GuardedExternalLink
            href={sourceUrl}
            target="_blank"
            className="text-sm font-medium underline underline-offset-4"
          >
            Read original
          </GuardedExternalLink>
        </div>

        <ReaderView
          apiUrl={readerApiUrl}
          fallbackTitle={params.title}
          fallbackSiteName={params.siteName}
          sourceUrl={sourceUrl}
        />
      </div>
    </div>
  )
}
