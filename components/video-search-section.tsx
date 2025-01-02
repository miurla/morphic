'use client'

import { DefaultSkeleton } from './default-skeleton'
import { Section, ToolArgsSection } from './section'
import type { SerperSearchResults } from '@/lib/types'
import { ToolInvocation } from 'ai'
import { VideoSearchResults } from './video-search-results'

interface VideoSearchSectionProps {
  tool: ToolInvocation
}

export function VideoSearchSection({ tool }: VideoSearchSectionProps) {
  const isLoading = tool.state === 'call'
  const searchResults: SerperSearchResults =
    tool.state === 'result' ? tool.result : undefined
  const query = tool.args.q as string | undefined

  return (
    <div>
      <ToolArgsSection tool="video_search">{query}</ToolArgsSection>
      {!isLoading && searchResults ? (
        <Section title="Videos">
          <VideoSearchResults results={searchResults} />
        </Section>
      ) : (
        <DefaultSkeleton />
      )}
    </div>
  )
}
