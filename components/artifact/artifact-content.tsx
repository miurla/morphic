'use client'

import { Part } from '@/lib/types/ai'

import { ReasoningContent } from './reasoning-content'
import { ToolInvocationContent } from './tool-invocation-content'

export function ArtifactContent({ part }: { part: Part | null }) {
  if (!part) return null

  switch (part.type) {
    case 'tool-search':
    case 'tool-fetch':
    case 'tool-videoSearch':
    case 'tool-askQuestion':
      return <ToolInvocationContent part={part} />
    case 'reasoning':
      return <ReasoningContent reasoning={part.text} />
    default:
      return (
        <div className="p-4">Details for this part type are not available</div>
      )
  }
}
