import React from 'react'

import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import type { DiscoveryPageData } from '@/lib/discovery/discovery'

import { DiscoveryPageContent } from './discovery-page-content'

const source = {
  id: 'source-1',
  kind: 'feed-item' as const,
  title: 'Source one',
  url: 'https://news.example.com/source-one',
  canonicalUrl: 'https://news.example.com/source-one',
  domain: 'news.example.com',
  summary: 'Source one summary.',
  publishedAt: '2026-06-05T12:00:00.000Z',
  retrievalMethod: 'feed' as const,
  provider: 'feed'
}

function data(overrides: Partial<DiscoveryPageData> = {}): DiscoveryPageData {
  return {
    generatedAt: '2026-06-05T12:30:00.000Z',
    sources: [source],
    clusters: [
      {
        id: 'cluster-1',
        title: 'Source one',
        summary: 'Source one summary.',
        category: 'Articles',
        storyKey: 'source-one',
        sourceCount: 1,
        freshnessScore: 100,
        sources: [source]
      }
    ],
    feedErrors: [],
    ...overrides
  }
}

describe('DiscoveryPageContent', () => {
  test('renders trending links and degrades Gist when there are not enough sources', () => {
    render(<DiscoveryPageContent data={data()} />)

    expect(screen.queryByRole('region', { name: 'Gist' })).toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Discovery' })
    ).toBeInTheDocument()

    const cluster = screen.getByRole('article', { name: 'Source one' })
    expect(within(cluster).getByText('Articles')).toBeInTheDocument()
    expect(
      within(cluster).getByRole('link', { name: 'Source one' })
    ).toHaveAttribute('href', 'https://news.example.com/source-one')
  })

  test('renders the Gist module above clusters when source coverage is sufficient', () => {
    render(
      <DiscoveryPageContent
        data={data({
          sources: [
            source,
            {
              ...source,
              id: 'source-2',
              title: 'Source two',
              url: 'https://analysis.example.com/source-two',
              canonicalUrl: 'https://analysis.example.com/source-two',
              domain: 'analysis.example.com',
              summary: 'Source two summary.'
            }
          ]
        })}
      />
    )

    const order = Array.from(
      document.querySelectorAll(
        '[aria-label="Gist"], [data-testid="story-clusters"]'
      )
    ).map(
      node =>
        node.getAttribute('aria-label') || node.getAttribute('data-testid')
    )

    expect(order).toEqual(['Gist', 'story-clusters'])
  })

  test('shows an empty state when no configured feed items are available', () => {
    render(
      <DiscoveryPageContent
        data={data({
          sources: [],
          clusters: [],
          feedErrors: ['https://broken.example.com/rss.xml']
        })}
      />
    )

    expect(
      screen.getByText('No configured feed items yet.')
    ).toBeInTheDocument()
    expect(screen.getByText('1 feed could not be read.')).toBeInTheDocument()
  })
})
