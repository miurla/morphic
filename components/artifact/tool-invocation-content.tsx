'use client'

import type { ToolPart } from '@/lib/types/ai'

import { RetrieveArtifactContent } from '@/components/artifact/retrieve-artifact-content'
import { SearchArtifactContent } from '@/components/artifact/search-artifact-content'
import { VideoSearchArtifactContent } from '@/components/artifact/video-search-artifact-content'

export function ToolInvocationContent({
  part
}: {
  part: ToolPart
}) {
  switch (part.type) {
    case 'tool-search':
      return <SearchArtifactContent tool={part} />
    case 'tool-retrieve':
      return <RetrieveArtifactContent tool={part} />
    case 'tool-videoSearch':
      return <VideoSearchArtifactContent tool={part} />
    default:
      return <div className="p-4">Details for this tool are not available</div>
  }
}
