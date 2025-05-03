'use client'

import { Button } from '@/components/ui/button'
import { Minimize2, Wrench } from 'lucide-react'
import { ArtifactContent } from './artifact-content'
import { useArtifact } from './artifact-context'

export function ArtifactPanel() {
  const { state, close } = useArtifact()
  const artifact = state.artifact
  if (!artifact) return null

  return (
    <div className="h-full flex flex-col overflow-hidden bg-muted">
      <div className="flex flex-col h-full m-4 mt-16 bg-background rounded-xl">
        <div className="flex items-center justify-between p-4">
          <h3 className="flex items-center gap-2">
            <div className="bg-muted p-2 rounded-md flex items-center gap-2">
              <Wrench size={18} />
            </div>
            <span className="text-sm font-medium capitalize">
              {artifact.toolName}
            </span>
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label="Close panel"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <ArtifactContent artifact={artifact} />
        </div>
      </div>
    </div>
  )
}
