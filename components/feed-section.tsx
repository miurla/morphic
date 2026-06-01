'use client'

import type React from 'react'

import {
  IconCheck as Check,
  IconExternalLink as ExternalLink,
  IconHeadphones as Headphones,
  IconRss as Rss
} from '@tabler/icons-react'

import type { ToolPart } from '@/lib/types/ai'
import type {
  FeedDiscoveryResult,
  FeedItem,
  ParsedFeed
} from '@/lib/types/feed'
import { cn } from '@/lib/utils'

import { StatusIndicator } from './ui/status-indicator'
import { CollapsibleMessage } from './collapsible-message'
import ProcessHeader from './process-header'
import { Section } from './section'

interface FeedSectionProps {
  tool: ToolPart<'feedSearch'>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  borderless?: boolean
  isFirst?: boolean
  isLast?: boolean
}

function formatDate(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatFeedKind(feed: FeedDiscoveryResult | ParsedFeed) {
  const format = feed.format === 'unknown' ? 'feed' : feed.format.toUpperCase()
  return feed.isPodcast ? `${format} podcast` : `${format} feed`
}

function FeedLink({
  href,
  children,
  className
}: {
  href?: string
  children: React.ReactNode
  className?: string
}) {
  if (!href) return <span className={className}>{children}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('hover:underline', className)}
    >
      {children}
    </a>
  )
}

function DiscoveredFeeds({ feeds }: { feeds: FeedDiscoveryResult[] }) {
  if (!feeds.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No feeds were discovered for this URL.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {feeds.map(feed => (
        <div
          key={`${feed.source}:${feed.url}`}
          className="rounded-lg border bg-card p-3 text-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <FeedLink href={feed.url} className="font-medium text-foreground">
                {feed.title || feed.siteName || feed.url}
              </FeedLink>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{formatFeedKind(feed)}</span>
                {feed.itemCount !== undefined && (
                  <span>{feed.itemCount} items</span>
                )}
                {feed.lastUpdated && (
                  <span>updated {formatDate(feed.lastUpdated)}</span>
                )}
                <span>{feed.source}</span>
              </div>
            </div>
            <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          </div>
          {feed.description && (
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              {feed.description}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function EpisodeMeta({ item }: { item: FeedItem }) {
  const enclosure = item.enclosures?.[0]
  const podcast = item.podcast

  return (
    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {formatDate(item.published || item.updated) && (
        <span>{formatDate(item.published || item.updated)}</span>
      )}
      {enclosure?.type && <span>{enclosure.type}</span>}
      {podcast?.season && <span>season {podcast.season}</span>}
      {podcast?.episode && <span>episode {podcast.episode}</span>}
      {podcast?.transcripts?.length ? <span>transcript</span> : null}
      {podcast?.chapters?.url ? <span>chapters</span> : null}
      {podcast?.value?.recipients.length ? <span>value4value</span> : null}
    </div>
  )
}

function FeedItems({ feed }: { feed: ParsedFeed }) {
  if (!feed.items.length) {
    return <p className="text-sm text-muted-foreground">No items found.</p>
  }

  return (
    <div className="space-y-2">
      {feed.items.map((item, index) => (
        <div
          key={item.id || item.url || `${item.title}-${index}`}
          className="rounded-lg border bg-card p-3 text-sm"
        >
          <FeedLink href={item.url} className="font-medium text-foreground">
            {item.title}
          </FeedLink>
          <EpisodeMeta item={item} />
          {(item.summary || item.content) && (
            <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
              {item.summary || item.content}
            </p>
          )}
          {item.enclosures?.[0]?.url && (
            <FeedLink
              href={item.enclosures[0].url}
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary"
            >
              <ExternalLink className="size-3" />
              Media enclosure
            </FeedLink>
          )}
        </div>
      ))}
    </div>
  )
}

export function FeedSection({
  tool,
  isOpen,
  onOpenChange,
  borderless = false,
  isFirst = false,
  isLast = false
}: FeedSectionProps) {
  const output = tool.state === 'output-available' ? tool.output : undefined
  const isSearching =
    tool.state === 'input-streaming' ||
    tool.state === 'input-available' ||
    output?.state === 'searching'
  const isError = tool.state === 'output-error'

  const completeOutput = output?.state === 'complete' ? output : undefined
  const action = tool.input?.action || output?.action || 'discover'
  const url = tool.input?.url || output?.url || ''
  const feeds = completeOutput?.feeds
  const feed = completeOutput?.feed
  const resultCount = feeds?.length ?? feed?.items.length ?? 0
  const isPodcast = Boolean(
    feed?.isPodcast || feeds?.some(feed => feed.isPodcast)
  )

  const header = (
    <ProcessHeader
      isLoading={isSearching}
      ariaExpanded={isOpen}
      label={
        <span className="inline-flex min-w-0 items-center gap-2 overflow-hidden">
          {isPodcast ? (
            <Headphones className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Rss className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">
            {action === 'read'
              ? feed?.title || `Reading feed: ${url}`
              : `Finding feeds: ${url}`}
          </span>
        </span>
      }
      meta={
        resultCount > 0 ? (
          <StatusIndicator icon={Check} iconClassName="text-green-500">
            {action === 'read'
              ? `${resultCount} items`
              : `${resultCount} feeds`}
          </StatusIndicator>
        ) : undefined
      }
    />
  )

  return (
    <div className="relative">
      {borderless && (
        <>
          {!isFirst && (
            <div className="absolute left-[19.5px] top-0 h-2 w-px bg-border" />
          )}
          {!isLast && (
            <div className="absolute bottom-0 left-[19.5px] h-2 w-px bg-border" />
          )}
        </>
      )}
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
        showBorder={!borderless}
        variant="default"
        showSeparator={false}
        headerClickBehavior="split"
      >
        <div className="flex">
          {borderless && (
            <>
              <div className="flex w-[16px] shrink-0 justify-center">
                <div
                  className={cn(
                    'w-px bg-border/50 transition-opacity duration-200',
                    isOpen ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{
                    marginTop: isFirst ? '0' : '-1rem',
                    marginBottom: isLast ? '0' : '-1rem'
                  }}
                />
              </div>
              <div className="w-2 shrink-0" />
            </>
          )}
          <div className="min-w-0 flex-1">
            {isError ? (
              <Section>
                <p className="text-sm text-destructive">
                  {tool.errorText || 'Feed lookup failed.'}
                </p>
              </Section>
            ) : isSearching ? (
              <Section>
                <p className="animate-pulse text-sm text-muted-foreground">
                  {action === 'read'
                    ? 'Reading feed...'
                    : 'Discovering feeds...'}
                </p>
              </Section>
            ) : feeds ? (
              <Section title="Feeds">
                <DiscoveredFeeds feeds={feeds} />
              </Section>
            ) : feed ? (
              <>
                <Section title={formatFeedKind(feed)}>
                  <div className="space-y-1 text-sm">
                    <FeedLink href={feed.url} className="font-medium">
                      {feed.title || feed.url}
                    </FeedLink>
                    {feed.description && (
                      <p className="text-xs text-muted-foreground">
                        {feed.description}
                      </p>
                    )}
                    {feed.podcast?.guid && (
                      <p className="text-xs text-muted-foreground">
                        Podcast GUID: {feed.podcast.guid}
                      </p>
                    )}
                  </div>
                </Section>
                <Section title={feed.isPodcast ? 'Episodes' : 'Items'}>
                  <FeedItems feed={feed} />
                </Section>
              </>
            ) : null}
            {completeOutput?.attribution && (
              <div className="px-3 pb-3 text-xs text-muted-foreground">
                <a
                  href={completeOutput.attribution.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {completeOutput.attribution.label}
                </a>
              </div>
            )}
          </div>
        </div>
      </CollapsibleMessage>
    </div>
  )
}
