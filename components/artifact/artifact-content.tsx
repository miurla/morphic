'use client'

import { Part } from '@/components/artifact/artifact-context'
import { ReasoningContent } from './reasoning-content'
import { ToolInvocationContent } from './tool-invocation-content'

export function ArtifactContent({ part }: { part: Part | null }) {
  if (!part) return null

  switch (part.type) {
    case 'tool-invocation':
      return <ToolInvocationContent toolInvocation={part.toolInvocation} />
    case 'reasoning':
      return <ReasoningContent reasoning={part.reasoning} />
    default:
      return (
        <div className="p-4">Details for this part type are not available</div>
      )
  }
}
