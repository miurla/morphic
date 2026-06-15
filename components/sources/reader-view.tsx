'use client'

import { useEffect, useState } from 'react'

import { GuardedExternalLink } from '@/components/navigation/guarded-external-link'

type ReaderResponse = {
  ok: boolean
  error?: string
  reader?: {
    title: string
    content: string
    sourceUrl: string
    url: string
    domain: string
    siteName?: string
    requestedTitle?: string
  }
}

interface ReaderViewProps {
  apiUrl: string
  sourceUrl: string
  fallbackTitle?: string
  fallbackSiteName?: string
}

export function ReaderView({
  apiUrl,
  sourceUrl,
  fallbackTitle,
  fallbackSiteName
}: ReaderViewProps) {
  const [data, setData] = useState<ReaderResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadReader() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(apiUrl)
        const body = (await response.json()) as ReaderResponse
        if (!response.ok || !body.ok) {
          throw new Error(body.error || 'Failed to load source')
        }
        if (!cancelled) {
          setData(body)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load source'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadReader()

    return () => {
      cancelled = true
    }
  }, [apiUrl])

  const reader = data?.reader
  const title = reader?.title || fallbackTitle || 'Source reader'
  const siteName = reader?.siteName || fallbackSiteName || reader?.domain

  return (
    <article className="flex flex-col gap-5">
      <header className="space-y-2 border-b pb-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {siteName ? <span>{siteName}</span> : null}
          {reader?.domain ? <span>{reader.domain}</span> : null}
        </div>
        <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
        <GuardedExternalLink
          href={reader?.sourceUrl || sourceUrl}
          target="_blank"
          className="break-all text-sm text-muted-foreground underline underline-offset-4"
        >
          {reader?.sourceUrl || sourceUrl}
        </GuardedExternalLink>
      </header>

      {loading ? (
        <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
          Loading source...
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : reader?.content ? (
        <div className="whitespace-pre-wrap text-base leading-7 text-foreground">
          {reader.content}
        </div>
      ) : (
        <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
          No readable text was found for this source.
        </div>
      )}
    </article>
  )
}
