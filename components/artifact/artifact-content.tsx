'use client'

import { Part, ToolPart } from '@/lib/types/ai'

import { ReasoningContent } from './reasoning-content'
import { TodoInvocationContent } from './todo-invocation-content'
import { ToolInvocationContent } from './tool-invocation-content'

// Type guard for Todo tool parts
function isTodoToolPart(part: Part): part is ToolPart<'todoWrite'> {
  return part.type === 'tool-todoWrite'
}

export function ArtifactContent({ part }: { part: Part | null }) {
  if (!part) return null

  switch (part.type) {
    case 'tool-search':
    case 'tool-fetch':
    case 'tool-askQuestion':
      return <ToolInvocationContent part={part} />
    case 'tool-todoWrite':
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
