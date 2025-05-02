'use client'

import { SearchResults } from '@/components/search-results'
import { SearchResultsImageSection } from '@/components/search-results-image'
import { Section } from '@/components/section'
import type { SearchResults as TypeSearchResults } from '@/lib/types'
import type { ToolInvocation } from 'ai'

export function ArtifactContent({
  artifact
}: {
  artifact: ToolInvocation | null
}) {
  if (!artifact) return null

  switch (artifact.toolName) {
    case 'search':
      return <SearchArtifactContent tool={artifact} />
    default:
      return <div className="p-4">Details for this tool are not available</div>
  }
}

function SearchArtifactContent({ tool }: { tool: ToolInvocation }) {
  const searchResults: TypeSearchResults =
    tool.state === 'result' ? tool.result : undefined
  const query = tool.args?.query as string | undefined

  if (!searchResults?.results) {
    return <div className="p-4">No search results</div>
  }

  return (
    <div className="p-4 space-y-6">
      {searchResults.images && searchResults.images.length > 0 && (
        <Section>
          <SearchResultsImageSection
            images={searchResults.images}
            query={query}
          />
        </Section>
      )}

      <Section title="Sources">
        <SearchResults results={searchResults.results} />
      </Section>
    </div>
  )
}
