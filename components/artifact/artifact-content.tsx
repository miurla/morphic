'use client'

import { SearchArtifactContent } from '@/components/artifact/search-artifact-content'
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
    default:
      return <div className="p-4">Details for this tool are not available</div>
  }
}
