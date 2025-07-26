'use client'

import { UseChatHelpers } from '@ai-sdk/react'

import type { SerperSearchResults } from '@/lib/types'
import type { ToolPart, UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'

import { useArtifact } from '@/components/artifact/artifact-context'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { Section, ToolArgsSection } from './section'
import { VideoSearchResults } from './video-search-results'

interface VideoSearchSectionProps {
  tool: ToolPart<'videoSearch'>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
}

export function VideoSearchSection({
  tool,
  isOpen,
  onOpenChange,
  status
}: VideoSearchSectionProps) {
  const isLoading = status === 'submitted' || status === 'streaming'

  const isToolLoading =
    tool.state === 'input-streaming' || tool.state === 'input-available'
  const videoResults: SerperSearchResults =
    tool.state === 'output-available' ? tool.output : undefined
  const query = tool.input?.query

  const { open } = useArtifact()
  const header = (
    <button
      type="button"
      onClick={() => open(tool)}
      className="flex items-center justify-between w-full text-left rounded-md p-1 -ml-1"
      title="Open details"
    >
      <ToolArgsSection tool="videoSearch" number={videoResults?.videos?.length}>
        {query}
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
      {!isLoading && videoResults ? (
        <Section title="Videos">
          <VideoSearchResults results={videoResults} />
        </Section>
      ) : (
        <DefaultSkeleton />
      )}
    </CollapsibleMessage>
  )
}
