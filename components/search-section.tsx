'use client'

import { SearchResults } from './search-results'
import { DefaultSkeleton } from './default-skeleton'
import { SearchResultsImageSection } from './search-results-image'
import { Section, ToolArgsSection } from './section'
import type { SearchResults as TypeSearchResults } from '@/lib/types'
import { ToolInvocation } from 'ai'

interface SearchSectionProps {
  tool: ToolInvocation
}

export function SearchSection({ tool }: SearchSectionProps) {
  const isLoading = tool.state === 'call'
  const searchResults: TypeSearchResults =
    tool.state === 'result' ? tool.result : undefined
  const query = tool.args.query as string | undefined
  const includeDomains = tool.args.includeDomains as string[] | undefined
  const includeDomainsString = includeDomains
    ? ` [${includeDomains.join(', ')}]`
    : ''

  return (
    <div>
      <ToolArgsSection tool="search">{`${query}${includeDomainsString}`}</ToolArgsSection>
      {searchResults &&
        searchResults.images &&
        searchResults.images.length > 0 && (
          <Section title="Images">
            <SearchResultsImageSection
              images={searchResults.images}
              query={query}
            />
          </Section>
        )}
      {!isLoading && searchResults.results ? (
        <Section title="Sources">
          <SearchResults results={searchResults.results} />
        </Section>
      ) : (
        <DefaultSkeleton />
      )}
    </div>
  )
}
