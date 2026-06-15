import React from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { SearchSection } from '../search-section'

vi.mock('@/components/artifact/artifact-context', () => ({
  useArtifact: () => ({ open: vi.fn() })
}))

vi.mock('../search-results', () => ({
  SearchResults: ({ results }: { results: Array<{ title: string }> }) => (
    <div data-testid="search-results">
      {results.map(result => result.title).join(',')}
    </div>
  )
}))

const completedSearchTool = {
  type: 'tool-search',
  toolCallId: 'tool-1',
  state: 'output-available',
  input: { query: 'Lagos Portugal' },
  output: {
    state: 'complete',
    query: 'Lagos Portugal',
    images: [],
    videos: [],
    results: [
      {
        title: 'Lagos guide',
        url: 'https://example.com/lagos',
        content: 'Lagos is a coastal city.'
      }
    ]
  }
} as any

describe('SearchSection', () => {
  test('renders source results while the research step is expanded alone', () => {
    render(
      <SearchSection
        tool={completedSearchTool}
        isOpen
        onOpenChange={() => {}}
      />
    )

    expect(screen.getByText('Sources')).toBeInTheDocument()
    expect(screen.getByTestId('search-results')).toHaveTextContent(
      'Lagos guide'
    )
  })

  test('hides the pre-answer source grid when final answer content follows', () => {
    render(
      <SearchSection
        tool={completedSearchTool}
        isOpen
        onOpenChange={() => {}}
        compactResults
      />
    )

    expect(screen.queryByText('Sources')).toBeNull()
    expect(screen.queryByTestId('search-results')).toBeNull()
  })
})
