'use client'

import { UseChatHelpers } from '@ai-sdk/react'
import type { ToolPart, UIMessage, UIDataTypes, UITools } from '@/lib/types/ai'

import { SearchResults as SearchResultsType } from '@/lib/types'

import { useArtifact } from '@/components/artifact/artifact-context'
import { SearchResults } from '@/components/search-results'
import { Section, ToolArgsSection } from '@/components/section'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'

interface RetrieveSectionProps {
  tool: ToolPart<'retrieve'>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
}

export function RetrieveSection({
  tool,
  isOpen,
  onOpenChange,
  status
}: RetrieveSectionProps) {
  const isToolLoading = tool.state === 'input-streaming' || tool.state === 'input-available'
  const isChatLoading = status === 'submitted' || status === 'streaming'
  const isLoading = isToolLoading || isChatLoading

  const data: SearchResultsType | undefined =
    tool.state === 'output-available' ? (tool.output || undefined) : undefined
  const url = tool.input?.url

  const { open } = useArtifact()
  const header = (
    <button
      type="button"
      onClick={() => open(tool)}
      className="flex items-center justify-between w-full text-left rounded-md p-1 -ml-1"
      title="Open details"
    >
      <ToolArgsSection tool="retrieve" number={data?.results?.length}>
        {url}
      </ToolArgsSection>
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
