'use client'

import type { SerperSearchResults } from '@/lib/types'
import { ToolInvocation } from 'ai'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { Section, ToolArgsSection } from './section'
import { VideoSearchResults } from './video-search-results'

interface VideoSearchSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function VideoSearchSection({
  tool,
  isOpen,
  onOpenChange
}: VideoSearchSectionProps) {
  const isLoading = tool.state === 'call'
  const searchResults: SerperSearchResults =
    tool.state === 'result' ? tool.result : undefined
  const query = tool.args.q as string | undefined

  const header = <ToolArgsSection tool="video_search">{query}</ToolArgsSection>

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {!isLoading && searchResults ? (
        <Section title="Videos">
          <VideoSearchResults results={searchResults} />
        </Section>
      ) : (
        <DefaultSkeleton />
      )}
    </CollapsibleMessage>
  )
}
