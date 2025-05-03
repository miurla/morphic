'use client'

import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { ArtifactContent } from './artifact-content'
import { useArtifact } from './artifact-context'

export function ArtifactPanel() {
  const { state, close } = useArtifact()
  const artifact = state.artifact
  if (!artifact) return null

  return (
    <div className="h-full flex flex-col overflow-hidden bg-muted">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-medium capitalize">
          {artifact.toolName === 'search'
            ? 'Search Results'
            : artifact.toolName}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={close}
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ArtifactContent artifact={artifact} />
      </div>
    </div>
  )
}
