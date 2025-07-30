'use client'

import type { SearchResults as TypeSearchResults } from '@/lib/types'
import type { ToolPart } from '@/lib/types/ai'

import { SearchResults } from '@/components/search-results'
import { SearchResultsImageSection } from '@/components/search-results-image'
import { Section, ToolArgsSection } from '@/components/section'
import {
  createVideoSearchResults,
  VideoSearchResults
} from '@/components/video-search-results'

export function SearchArtifactContent({ tool }: { tool: ToolPart<'search'> }) {
  const searchResults: TypeSearchResults | undefined =
    tool.state === 'output-available' ? tool.output : undefined
  const query = tool.input?.query

  const hasResults =
    searchResults &&
    ((searchResults.results && searchResults.results.length > 0) ||
      (searchResults.videos && searchResults.videos.length > 0) ||
      (searchResults.images && searchResults.images.length > 0))

  if (!hasResults) {
    return <div className="p-4">No search results</div>
  }

  return (
    <div className="space-y-2">
      <div className="pb-2">
        <ToolArgsSection
          tool="search"
          number={
            (searchResults.results?.length || 0) +
            (searchResults.videos?.length || 0) +
            (searchResults.images?.length || 0)
          }
        >{`${query}`}</ToolArgsSection>
      </div>

      {searchResults.images && searchResults.images.length > 0 && (
        <SearchResultsImageSection
          images={searchResults.images}
          query={query}
          displayMode="full"
        />
      )}

      {searchResults.videos && searchResults.videos.length > 0 && (
        <Section title="Videos">
          <VideoSearchResults
            results={createVideoSearchResults(searchResults, query)}
            displayMode="artifact"
          />
        </Section>
      )}

      {searchResults.results && searchResults.results.length > 0 && (
        <Section title="Sources">
          <SearchResults results={searchResults.results} displayMode="list" />
        </Section>
      )}
    </div>
  )
}
