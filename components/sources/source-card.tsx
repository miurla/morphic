'use client'

import { useState } from 'react'

import { Bookmark, Check, OpenNewWindow as ExternalLink, PageEdit as FileText, Headset as Headphones, MediaImage as Photo, Book as Reader, RssFeed as Rss, Globe as World } from 'iconoir-react'
import { toast } from 'sonner'

import {
  currentSourceEventPagePath,
  trackSourceEvent
} from '@/lib/sources/client-source-events'
import { buildReaderUrl } from '@/lib/sources/reader'
import type { NormalizedSource, SourceKind } from '@/lib/sources/source-types'
import { cn } from '@/lib/utils'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

import { GuardedExternalLink } from '@/components/navigation/guarded-external-link'

interface SourceCardProps {
  source: NormalizedSource
  compact?: boolean
}

function sourceKindIcon(kind: SourceKind) {
  switch (kind) {
    case 'feed':
    case 'feed-item':
      return Rss
    case 'podcast':
      return Headphones
    case 'image':
      return Photo
    case 'pdf':
    case 'official-doc':
    case 'academic':
      return FileText
    default:
      return World
  }
}

function formatSourceDate(value?: string) {
  if (!value) {
    return undefined
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function displaySite(source: NormalizedSource) {
  return source.siteName || source.domain || source.provider || 'Source'
}

function sourcePreferenceLabel(
  preference?: NormalizedSource['sourcePreference']
) {
  switch (preference?.preference) {
    case 'trust':
      return 'Trusted'
    case 'prefer':
      return 'Preferred'
    case 'mute':
      return 'Avoided'
    case 'block':
      return 'Blocked'
    default:
      return undefined
  }
}

export function SourceCard({ source, compact = false }: SourceCardProps) {
  const Icon = sourceKindIcon(source.kind)
  const date = formatSourceDate(source.publishedAt || source.updatedAt)
  const summary = source.summary || source.snippet
  const preferenceLabel = sourcePreferenceLabel(source.sourcePreference)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const handleReadOriginal = () => {
    if (!source.url) {
      return
    }

    trackSourceEvent({
      eventType: 'open_original',
      sourceId: source.id,
      sourceUrl: source.url,
      sourceDomain: source.domain,
      pageUrl: currentSourceEventPagePath(),
      metadata: {
        sourceKind: source.kind,
        provider: source.provider,
        retrievalMethod: source.retrievalMethod,
        rank: source.rank
      }
    })
  }

  const handleSaveSource = async () => {
    if (!source.url || isSaving) {
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/reading-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceId: source.id,
          url: source.url,
          canonicalUrl: source.canonicalUrl,
          title: source.title,
          author: source.author,
          siteName: source.siteName,
          domain: source.domain,
          publishedAt: source.publishedAt,
          summary,
          imageUrl: source.imageUrl,
          faviconUrl: source.faviconUrl,
          savedFromChatId: undefined
        })
      })

      if (!response.ok) {
        throw new Error(`Save failed with HTTP ${response.status}`)
      }

      setIsSaved(true)
      toast.success('Source saved')
    } catch (error) {
      console.error('Failed to save source:', error)
      toast.error('Failed to save source')
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenReader = () => {
    if (!source.url) {
      return
    }

    trackSourceEvent({
      eventType: 'open_reader',
      sourceId: source.id,
      sourceUrl: source.url,
      sourceDomain: source.domain,
      pageUrl: currentSourceEventPagePath(),
      metadata: {
        sourceKind: source.kind,
        provider: source.provider,
        retrievalMethod: source.retrievalMethod,
        rank: source.rank
      }
    })
  }

  return (
    <article
      className={cn(
        'flex min-w-0 flex-col justify-between rounded-md border bg-card p-3 text-sm',
        compact ? 'gap-2' : 'gap-3'
      )}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex min-w-0 items-start gap-2">
          <Avatar className="mt-0.5 size-5 shrink-0">
            {source.faviconUrl ? (
              <AvatarImage src={source.faviconUrl} alt={displaySite(source)} />
            ) : source.domain ? (
              <AvatarImage
                src={`https://www.google.com/s2/favicons?domain=${source.domain}`}
                alt={source.domain}
              />
            ) : null}
            <AvatarFallback>
              <Icon className="size-3" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
              {source.title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-tight text-muted-foreground">
              <span className="max-w-full truncate">{displaySite(source)}</span>
              <span>{source.kind}</span>
              {date ? <span>{date}</span> : null}
              {preferenceLabel ? (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                  {preferenceLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {summary ? (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {summary}
          </p>
        ) : null}
      </div>

      {source.url ? (
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] text-muted-foreground/75">
            {source.domain || source.url}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-full"
              aria-label={isSaved ? 'Source saved' : 'Save source'}
              disabled={isSaving || isSaved}
              onClick={handleSaveSource}
            >
              {isSaved ? (
                <Check className="size-3.5" />
              ) : (
                <Bookmark className="size-3.5" />
              )}
            </Button>
            <Button
              asChild
              variant="outline"
              size="icon"
              className="size-8 rounded-full"
            >
              <a
                href={buildReaderUrl({
                  url: source.url,
                  title: source.title,
                  siteName: source.siteName,
                  sourceId: source.id
                })}
                onClick={handleOpenReader}
                aria-label="Open reader"
              >
                <Reader className="size-3.5" />
              </a>
            </Button>
            <Button asChild size="sm" className="h-8 shrink-0 gap-1.5">
              <GuardedExternalLink
                href={source.url}
                target="_blank"
                onClick={handleReadOriginal}
              >
                Read original
                <ExternalLink className="size-3.5" />
              </GuardedExternalLink>
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  )
}
