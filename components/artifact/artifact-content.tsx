'use client'

import { Part, ToolPart } from '@/lib/types/ai'

import { useI18n } from '@/components/language-provider'

import { DraftPanel } from '../draft/draft-panel'

import { ReasoningContent } from './reasoning-content'
import { TodoInvocationContent } from './todo-invocation-content'
import { ToolInvocationContent } from './tool-invocation-content'

// Type guard for Todo tool parts
function isTodoToolPart(part: Part): part is ToolPart<'todoWrite'> {
  return part.type === 'tool-todoWrite'
}

export function ArtifactContent({ part }: { part: Part | null }) {
  const { t } = useI18n()

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
    case 'draft':
      return <DraftPanel />
    default:
      return (
        <div className="p-4">
          {t('Details for this part type are not available')}
        </div>
      )
  }
}
