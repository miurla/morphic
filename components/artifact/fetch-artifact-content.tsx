'use client'

import type { ToolPart } from '@/lib/types/ai'
import type {
  SearchResultItem,
  SearchResults as TypeSearchResults
} from '@/lib/types/index'

import { SearchResults } from '@/components/search-results'
import { Section, ToolArgsSection } from '@/components/section'

import { MemoizedReactMarkdown } from '../ui/markdown'

const MAX_CONTENT_LENGTH = 1000

export function FetchArtifactContent({
  tool
}: {
  tool: ToolPart<'fetch'>
}) {
  const searchResults: TypeSearchResults | undefined =
    tool.state === 'output-available' ? (tool.output ?? undefined) : undefined
  const url = tool.input?.url

  if (!searchResults?.results) {
    return <div className="p-4">No retrieved content</div>
  }

  const truncatedResults: SearchResultItem[] = searchResults.results.map(
    result => ({
      ...result,
      content:
        result.content.length > MAX_CONTENT_LENGTH
          ? `${result.content.substring(0, MAX_CONTENT_LENGTH)}...`
          : result.content
    })
  )

  return (
    <div className="space-y-2">
      <ToolArgsSection tool="fetch">{url}</ToolArgsSection>

      <Section title="Sources">
        <SearchResults results={truncatedResults} displayMode="list" />
      </Section>
      {truncatedResults[0].content && (
        <Section title="Content">
          <MemoizedReactMarkdown className="prose-sm prose-neutral prose-p:text-sm text-muted-foreground">
            {truncatedResults[0].content}
          </MemoizedReactMarkdown>
        </Section>
      )}
    </div>
  )
}
