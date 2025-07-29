'use client'

import type { ToolPart } from '@/lib/types/ai'

import { FetchArtifactContent } from '@/components/artifact/fetch-artifact-content'
import { SearchArtifactContent } from '@/components/artifact/search-artifact-content'
import { VideoSearchArtifactContent } from '@/components/artifact/video-search-artifact-content'

export function ToolInvocationContent({ part }: { part: ToolPart }) {
  switch (part.type) {
    case 'tool-search':
      return <SearchArtifactContent tool={part as ToolPart<'search'>} />
    case 'tool-fetch':
      return <FetchArtifactContent tool={part as ToolPart<'fetch'>} />
    case 'tool-videoSearch':
      return (
        <VideoSearchArtifactContent tool={part as ToolPart<'videoSearch'>} />
      )
    default:
      return <div className="p-4">Details for this tool are not available</div>
  }
}
