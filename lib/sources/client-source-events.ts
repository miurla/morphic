'use client'

import type { SourceEventMetadata, SourceEventType } from './source-events'

export interface TrackSourceEventInput {
  eventType: SourceEventType
  sourceId?: string
  chatId?: string
  sourceUrl: string
  sourceDomain?: string
  pageUrl?: string
  metadata?: SourceEventMetadata
}

export function currentSourceEventPagePath(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.location.pathname || undefined
}

export function trackSourceEvent(input: TrackSourceEventInput): void {
  if (typeof window === 'undefined') {
    return
  }

  const payload = JSON.stringify({
    ...input,
    pageUrl: input.pageUrl ?? currentSourceEventPagePath()
  })

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      if (navigator.sendBeacon('/api/source-events', blob)) {
        return
      }
    }

    void fetch('/api/source-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: payload,
      keepalive: true
    }).catch(() => {})
  } catch {
    // Source analytics must never block or break navigation.
  }
}
