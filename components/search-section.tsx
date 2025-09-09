'use client'

import { UseChatHelpers } from '@ai-sdk/react'
import { Check, Search as SearchIcon } from 'lucide-react'

import type { SearchResults as TypeSearchResults } from '@/lib/types'
import type { ToolPart, UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import { useArtifact } from '@/components/artifact/artifact-context'

import { StatusIndicator } from './ui/status-indicator'
import { CollapsibleMessage } from './collapsible-message'
import { SearchSkeleton } from './default-skeleton'
import ProcessHeader from './process-header'
import { SearchResults } from './search-results'
import { SearchResultsImageSection } from './search-results-image'
import { Section } from './section'
import {
  createVideoSearchResults,
  VideoSearchResults
} from './video-search-results'

interface SearchSectionProps {
  tool: ToolPart<'search'>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  borderless?: boolean
  isFirst?: boolean
  isLast?: boolean
}

export function SearchSection({
  tool,
  isOpen,
  onOpenChange,
  status,
  borderless,
  isFirst = false,
  isLast = false
}: SearchSectionProps) {
  const isLoading = status === 'submitted' || status === 'streaming'

  const isToolLoading =
    tool.state === 'input-streaming' || tool.state === 'input-available'
  const searchResults: TypeSearchResults | undefined =
    tool.state === 'output-available' ? tool.output : undefined
  const isError = tool.state === 'output-error'
  const errorMessage = tool.errorText || 'Search failed'
  const query = tool.input?.query || ''
  const includeDomains = tool.input?.include_domains
  const includeDomainsString =
    includeDomains && includeDomains.length > 0
      ? ` [${includeDomains.join(', ')}]`
      : ''

  const { open } = useArtifact()

  const totalResults =
    (searchResults?.results?.length || 0) +
    (searchResults?.videos?.length || 0) +
    (searchResults?.images?.length || 0)

  const header = (
    <ProcessHeader
      onInspect={() => open(tool)}
      isLoading={isLoading && isToolLoading}
      ariaExpanded={isOpen}
      label={
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate block min-w-0 max-w-full">{`${query}${includeDomainsString}`}</span>
        </div>
      }
      meta={
        searchResults && totalResults > 0 ? (
          <StatusIndicator icon={Check} iconClassName="text-green-500">
            {totalResults} results
          </StatusIndicator>
        ) : undefined
      }
    />
  )

  return (
    <div className="relative">
      {/* Rails for header - show based on position */}
      {borderless && (
        <>
          {!isFirst && (
            <div className="absolute left-[19.5px] w-px bg-border h-2 top-0" />
          )}
          {!isLast && (
            <div className="absolute left-[19.5px] w-px bg-border h-2 bottom-0" />
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
          {/* Rail space - always reserved when grouped */}
          {borderless && (
            <>
              <div className="w-[16px] shrink-0 flex justify-center">
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
          <div className="flex-1">
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
            {searchResults &&
              searchResults.videos &&
              searchResults.videos.length > 0 && (
                <Section title="Videos">
                  <VideoSearchResults
                    results={createVideoSearchResults(searchResults, query)}
                  />
                </Section>
              )}
            {isError ? (
              <Section>
                <div className="bg-card rounded-lg">
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-sm text-destructive block flex-1 min-w-0">
                      {errorMessage}
                    </span>
                  </div>
                </div>
              </Section>
            ) : isLoading && isToolLoading ? (
              <SearchSkeleton />
            ) : searchResults?.results && searchResults.results.length > 0 ? (
              <Section title="Sources">
                <SearchResults results={searchResults.results} />
              </Section>
            ) : null}
          </div>
        </div>
      </CollapsibleMessage>
    </div>
  )
}
