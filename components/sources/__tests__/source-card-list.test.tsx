import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NormalizedSource } from '@/lib/sources/source-types'

import { SourceCardList } from '../source-card-list'

const mockTrackSourceEvent = vi.fn()

vi.mock('@/lib/sources/client-source-events', () => ({
  currentSourceEventPagePath: () => window.location.pathname,
  trackSourceEvent: (...args: unknown[]) => mockTrackSourceEvent(...args)
}))

const baseSource: NormalizedSource = {
  id: 'source_search_abc',
  kind: 'web',
  title: 'Original reporting',
  url: 'https://example.com/report',
  canonicalUrl: 'https://example.com/report',
  domain: 'example.com',
  siteName: 'Example',
  publishedAt: '2026-06-01T12:00:00.000Z',
  snippet: 'A concise source summary.',
  provider: 'qwant',
  retrievalMethod: 'search',
  rank: 1
}

describe('SourceCardList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', '/search/chat_123?query=private')
  })

  it('renders source metadata and a safe read-original action', () => {
    render(<SourceCardList sources={[baseSource]} />)

    expect(screen.getByText('Original reporting')).toBeInTheDocument()
    expect(screen.getByText('Example')).toBeInTheDocument()
    expect(screen.getByText('web')).toBeInTheDocument()
    expect(screen.getByText('Jun 1, 2026')).toBeInTheDocument()
    expect(screen.getByText('A concise source summary.')).toBeInTheDocument()

    const readOriginal = screen.getByRole('link', { name: 'Read original' })
    expect(readOriginal).toHaveAttribute('href', 'https://example.com/report')
    expect(readOriginal).toHaveAttribute('target', '_blank')
  })

  it('tracks read-original clicks with minimal source metadata', () => {
    render(<SourceCardList sources={[baseSource]} />)

    fireEvent.click(screen.getByRole('link', { name: 'Read original' }))

    expect(mockTrackSourceEvent).toHaveBeenCalledWith({
      eventType: 'open_original',
      sourceId: 'source_search_abc',
      sourceUrl: 'https://example.com/report',
      sourceDomain: 'example.com',
      pageUrl: '/search/chat_123',
      metadata: {
        sourceKind: 'web',
        provider: 'qwant',
        retrievalMethod: 'search',
        rank: 1
      }
    })
  })

  it('offers an explicit reader action and tracks reader opens', () => {
    render(<SourceCardList sources={[baseSource]} />)

    const readerLink = screen.getByRole('link', { name: 'Open reader' })
    expect(readerLink).toHaveAttribute(
      'href',
      '/reader?url=https%3A%2F%2Fexample.com%2Freport&title=Original+reporting&siteName=Example&sourceId=source_search_abc'
    )

    readerLink.addEventListener('click', event => event.preventDefault())
    fireEvent.click(readerLink)

    expect(mockTrackSourceEvent).toHaveBeenCalledWith({
      eventType: 'open_reader',
      sourceId: 'source_search_abc',
      sourceUrl: 'https://example.com/report',
      sourceDomain: 'example.com',
      pageUrl: '/search/chat_123',
      metadata: {
        sourceKind: 'web',
        provider: 'qwant',
        retrievalMethod: 'search',
        rank: 1
      }
    })
  })

  it('saves a source to the reading queue', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, item: { id: 'reading_123' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    render(<SourceCardList sources={[baseSource]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save source' }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/reading-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceId: 'source_search_abc',
          url: 'https://example.com/report',
          canonicalUrl: 'https://example.com/report',
          title: 'Original reporting',
          author: undefined,
          siteName: 'Example',
          domain: 'example.com',
          publishedAt: '2026-06-01T12:00:00.000Z',
          summary: 'A concise source summary.',
          imageUrl: undefined,
          faviconUrl: undefined,
          savedFromChatId: undefined
        })
      })
    })

    fetchSpy.mockRestore()
  })

  it('handles missing optional metadata without rendering broken controls', () => {
    render(
      <SourceCardList
        sources={[
          {
            ...baseSource,
            id: 'source_unknown',
            kind: 'unknown',
            title: 'Untitled source',
            url: undefined,
            canonicalUrl: undefined,
            domain: undefined,
            siteName: undefined,
            publishedAt: undefined,
            snippet: undefined
          }
        ]}
      />
    )

    expect(screen.getByText('Untitled source')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Read original' })).toBeNull()
  })
})
