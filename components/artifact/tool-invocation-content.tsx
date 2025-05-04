'use client'

import { RetrieveArtifactContent } from '@/components/artifact/retrieve-artifact-content'
import { SearchArtifactContent } from '@/components/artifact/search-artifact-content'
import { VideoSearchArtifactContent } from '@/components/artifact/video-search-artifact-content'
import type { ToolInvocation } from 'ai'

export function ToolInvocationContent({
  toolInvocation
}: {
  toolInvocation: ToolInvocation
}) {
  switch (toolInvocation.toolName) {
    case 'search':
      return <SearchArtifactContent tool={toolInvocation} />
    case 'retrieve':
      return <RetrieveArtifactContent tool={toolInvocation} />
    case 'videoSearch':
      return <VideoSearchArtifactContent tool={toolInvocation} />
    default:
      return <div className="p-4">Details for this tool are not available</div>
  }
}
