'use client'

import { DefaultSkeleton } from './default-skeleton'
import { Section, ToolArgsSection } from './section'
import type { SerperSearchResults } from '@/lib/types'
import { ToolInvocation } from 'ai'
import { VideoSearchResults } from './video-search-results'
import { CollapsibleMessage } from './collapsible-message'

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
