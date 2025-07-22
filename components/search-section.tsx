'use client'

import { UseChatHelpers } from '@ai-sdk/react'
import type { ToolPart, UIMessage, UIDataTypes, UITools } from '@/lib/types/ai'

import type { SearchResults as TypeSearchResults } from '@/lib/types'

import { useArtifact } from '@/components/artifact/artifact-context'

import { CollapsibleMessage } from './collapsible-message'
import { SearchSkeleton } from './default-skeleton'
import { SearchResults } from './search-results'
import { SearchResultsImageSection } from './search-results-image'
import { Section, ToolArgsSection } from './section'

interface SearchSectionProps {
  tool: ToolPart<'search'>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
}

export function SearchSection({
  tool,
  isOpen,
  onOpenChange,
  status
}: SearchSectionProps) {
  const isLoading = status === 'submitted' || status === 'streaming'

  const isToolLoading = tool.state === 'input-streaming' || tool.state === 'input-available'
  const searchResults: TypeSearchResults =
    tool.state === 'output-available' ? tool.output : undefined
  const query = tool.input?.query
  const includeDomains = tool.input?.include_domains
  const includeDomainsString = includeDomains
    ? ` [${includeDomains.join(', ')}]`
    : ''

  const { open } = useArtifact()
  const header = (
    <button
      type="button"
      onClick={() => open(tool)}
      className="flex items-center justify-between w-full text-left rounded-md p-1 -ml-1"
      title="Open details"
    >
      <ToolArgsSection
        tool="search"
        number={searchResults?.results?.length}
      >{`${query}${includeDomainsString}`}</ToolArgsSection>
    </button>
  )

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {searchResults &&
        searchResults.images &&
        searchResults.images.length > 0 && (
          <Section>
            <SearchResultsImageSection
              images={searchResults.images}
              query={query}
            />
          </Section>
        )}
      {isLoading && isToolLoading ? (
        <SearchSkeleton />
      ) : searchResults?.results ? (
        <Section title="Sources">
          <SearchResults results={searchResults.results} />
        </Section>
      ) : null}
    </CollapsibleMessage>
  )
}
