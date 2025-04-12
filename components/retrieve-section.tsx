'use client'

import { SearchResults } from '@/components/search-results'
import { Section, ToolArgsSection } from '@/components/section'
import { SearchResults as SearchResultsType } from '@/lib/types'
import { ToolInvocation } from 'ai'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'

interface RetrieveSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function RetrieveSection({
  tool,
  isOpen,
  onOpenChange
}: RetrieveSectionProps) {
  const isLoading = tool.state === 'call'
  const data: SearchResultsType =
    tool.state === 'result' ? tool.result : undefined
  const url = tool.args.url as string | undefined

  const header = <ToolArgsSection tool="retrieve">{url}</ToolArgsSection>

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {!isLoading && data ? (
        <Section title="Sources">
          <SearchResults results={data.results} />
        </Section>
      ) : (
        <DefaultSkeleton />
      )}
    </CollapsibleMessage>
  )
}

export default RetrieveSection
