'use client'

import { Section, ToolArgsSection } from '@/components/section'
import { SearchResults } from '@/components/search-results'
import { SearchResults as SearchResultsType } from '@/lib/types'
import { ToolInvocation } from 'ai'
import { DefaultSkeleton } from './default-skeleton'
import { ToolBadge } from './tool-badge'

interface RetrieveSectionProps {
  tool: ToolInvocation
}

export function RetrieveSection({ tool }: RetrieveSectionProps) {
  const isLoading = tool.state === 'call'
  const data: SearchResultsType =
    tool.state === 'result' ? tool.result : undefined
  const url = tool.args.url as string | undefined

  return (
    <div>
      <ToolArgsSection tool="retrieve">{url}</ToolArgsSection>
      {!isLoading && data ? (
        <Section title="Sources">
          <SearchResults results={data.results} />
        </Section>
      ) : (
        <DefaultSkeleton />
      )}
    </div>
  )
}

export default RetrieveSection
