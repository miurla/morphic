'use client'

import { RetrieveArtifactContent } from '@/components/artifact/retrieve-artifact-content'
import { SearchArtifactContent } from '@/components/artifact/search-artifact-content'
import { VideoSearchArtifactContent } from '@/components/artifact/video-search-artifact-content'
import type { ToolInvocation } from 'ai'

export function ArtifactContent({
  artifact
}: {
  artifact: ToolInvocation | null
}) {
  if (!artifact) return null

  switch (artifact.toolName) {
    case 'search':
      return <SearchArtifactContent tool={artifact} />
    case 'retrieve':
      return <RetrieveArtifactContent tool={artifact} />
    case 'videoSearch':
      return <VideoSearchArtifactContent tool={artifact} />
    default:
      return <div className="p-4">Details for this tool are not available</div>
  }
}
