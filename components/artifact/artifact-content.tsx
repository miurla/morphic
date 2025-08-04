'use client'

import { Part, TodoToolPart } from '@/lib/types/ai'

import { ReasoningContent } from './reasoning-content'
import { TodoInvocationContent } from './todo-invocation-content'
import { ToolInvocationContent } from './tool-invocation-content'

// Type guard for TodoToolPart
function isTodoToolPart(part: Part): part is TodoToolPart {
  return part.type === 'tool-todoWrite' || part.type === 'tool-todoRead'
}

export function ArtifactContent({ part }: { part: Part | null }) {
  if (!part) return null

  switch (part.type) {
    case 'tool-search':
    case 'tool-fetch':
    case 'tool-askQuestion':
      return <ToolInvocationContent part={part} />
    case 'tool-todoWrite':
    case 'tool-todoRead':
      if (isTodoToolPart(part)) {
        return <TodoInvocationContent part={part} />
      }
      return null
    case 'reasoning':
      return <ReasoningContent reasoning={part.text} />
    default:
      return (
        <div className="p-4">Details for this part type are not available</div>
      )
  }
}
