'use client'

import type { ToolPart } from '@/lib/types/ai'
import {
  type SerperSearchResultItem,
  type SerperSearchResults
} from '@/lib/types'

import { ToolArgsSection } from '@/components/section'
import { VideoResultGrid } from '@/components/video-result-grid'

export function VideoSearchArtifactContent({ tool }: { tool: ToolPart<'videoSearch'> }) {
  const videoResults: SerperSearchResults | undefined =
    tool.state === 'output-available' ? tool.output : undefined
  const query = tool.input?.query

  const videos = (videoResults?.videos || []).filter(
    (video: SerperSearchResultItem) => {
      try {
        return new URL(video.link).pathname === '/watch'
      } catch (e) {
        console.error('Invalid video URL:', video.link)
        return false
      }
    }
  )

  if (videos.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <ToolArgsSection tool="videoSearch">{query}</ToolArgsSection>
        <p className="text-muted-foreground">No video results</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <ToolArgsSection tool="videoSearch">{query}</ToolArgsSection>
      <VideoResultGrid
        videos={videos}
        query={query || ''}
        displayMode="artifact"
      />
    </div>
  )
}
