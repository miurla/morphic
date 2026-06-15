import React from 'react'

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import type { NormalizedSource } from '@/lib/sources/source-types'

import { GistModule } from './gist-module'

function source(
  overrides: Partial<NormalizedSource> & Pick<NormalizedSource, 'id' | 'title'>
): NormalizedSource {
  return {
    kind: 'web',
    retrievalMethod: 'search',
    url: `https://${overrides.domain || 'example.com'}/${overrides.id}`,
    canonicalUrl: `https://${overrides.domain || 'example.com'}/${overrides.id}`,
    domain: overrides.domain || 'example.com',
    snippet: 'A source-backed snippet with enough detail to summarize.',
    ...overrides
  }
}

describe('GistModule', () => {
  test('does not render when source coverage is too thin', () => {
    const { container } = render(
      <GistModule
        sources={[
          source({
            id: 'source-1',
            title: 'Only source'
          })
        ]}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })

  test('renders source-backed cards and keeps source IDs attached', () => {
    render(
      <GistModule
        sources={[
          source({
            id: 'source-1',
            title: 'Primary report',
            snippet: 'The strongest source says the policy changed today.'
          }),
          source({
            id: 'source-2',
            title: 'Follow-up analysis',
            domain: 'analysis.example',
            summary: 'A second source adds context about downstream effects.'
          }),
          source({
            id: 'source-3',
            title: 'Repeated report',
            snippet: 'The strongest source says the policy changed today.'
          })
        ]}
      />
    )

    expect(screen.getByRole('region', { name: 'Gist' })).toBeInTheDocument()
    expect(screen.getByText('Quick summary')).toBeInTheDocument()

    const activeCard = screen.getByTestId('gist-card-summary')
    expect(within(activeCard).getByText('example.com')).toBeInTheDocument()
    expect(within(activeCard).getByText('analysis.example')).toBeInTheDocument()
    expect(within(activeCard).queryByText('source-1')).not.toBeInTheDocument()
    expect(within(activeCard).queryByText('source-2')).not.toBeInTheDocument()
    expect(within(activeCard).queryByText('source-3')).not.toBeInTheDocument()
  })

  test('renders knowledge graph entities separately from source labels', () => {
    render(
      <GistModule
        sources={[
          source({
            id: 'source_search_abc',
            title: 'Lagos, Portugal - Wikipedia',
            domain: 'wikipedia.org',
            snippet: 'Lagos is a city in Portugal.'
          }),
          source({
            id: 'source_search_def',
            title: 'Lagos travel guide',
            domain: 'lagosportugalguide.com',
            snippet: 'Lagos is in the Algarve.'
          })
        ]}
        entities={[
          {
            label: 'Lagos',
            description: 'municipality in Portugal',
            matchedText: 'Lagos Portugal',
            wikidataId: 'Q209489',
            wikidataUrl: 'https://www.wikidata.org/wiki/Q209489',
            dbpediaUri: 'http://dbpedia.org/resource/Lagos,_Portugal',
            dbpediaUrl: 'https://dbpedia.org/resource/Lagos,_Portugal',
            source: 'both',
            confidence: 0.95
          }
        ]}
      />
    )

    expect(screen.getByRole('link', { name: 'Lagos' })).toHaveAttribute(
      'href',
      'https://www.wikidata.org/wiki/Q209489'
    )
    expect(screen.getByText('wikipedia.org')).toBeInTheDocument()
    expect(screen.queryByText('source_search_abc')).not.toBeInTheDocument()
  })

  test('missing media does not prevent cards from rendering', () => {
    render(
      <GistModule
        sources={[
          source({
            id: 'source-1',
            title: 'Text-only report',
            imageUrl: undefined,
            snippet: 'The first text-only source covers the main result.'
          }),
          source({
            id: 'source-2',
            title: 'Text-only follow-up',
            imageUrl: undefined,
            snippet: 'The second text-only source adds separate context.'
          })
        ]}
      />
    )

    expect(screen.getByTestId('gist-card-summary')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  test('keyboard navigation moves through cards without hiding original links', () => {
    render(
      <GistModule
        sources={[
          source({
            id: 'source-1',
            title: 'Primary report',
            snippet: 'Primary report has a distinct claim.'
          }),
          source({
            id: 'source-2',
            title: 'Follow-up analysis',
            domain: 'analysis.example',
            snippet: 'Follow-up analysis has separate context.'
          })
        ]}
      />
    )

    const region = screen.getByRole('region', { name: 'Gist' })
    fireEvent.keyDown(region, { key: 'ArrowRight' })

    expect(screen.getByTestId('gist-card-context')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next Gist card' }))

    const originalsCard = screen.getByTestId('gist-card-read-originals')
    expect(
      within(originalsCard).getByRole('link', { name: /Primary report/ })
    ).toHaveAttribute('href', 'https://example.com/source-1')
    expect(
      within(originalsCard).getByRole('link', { name: /Follow-up analysis/ })
    ).toHaveAttribute('href', 'https://analysis.example/source-2')
  })

  test('touch swipe advances cards on mobile-sized interactions', () => {
    render(
      <GistModule
        sources={[
          source({
            id: 'source-1',
            title: 'Primary report',
            snippet: 'Primary report has a distinct claim.'
          }),
          source({
            id: 'source-2',
            title: 'Follow-up analysis',
            snippet: 'Follow-up analysis has separate context.'
          })
        ]}
      />
    )

    const carousel = screen.getByTestId('gist-carousel')
    fireEvent.touchStart(carousel, {
      touches: [{ clientX: 240 }]
    })
    fireEvent.touchEnd(carousel, {
      changedTouches: [{ clientX: 120 }]
    })

    expect(screen.getByTestId('gist-card-context')).toBeInTheDocument()
  })
})
