'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Minimize2, Wrench } from 'lucide-react'
import { ArtifactContent } from './artifact-content'
import { useArtifact } from './artifact-context'

export function ArtifactPanel() {
  const { state, close } = useArtifact()
  const artifact = state.artifact
  if (!artifact) return null

  return (
    <div className="h-full flex flex-col overflow-hidden bg-muted md:px-4 md:py-4 md:pb-4 md:pt-14">
      <div className="flex flex-col h-full bg-background rounded-xl">
        <div className="flex items-center justify-between px-4 py-2">
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
        <Separator className="my-1 bg-border/50" />
        <div className="flex-1 overflow-y-auto p-4">
          <ArtifactContent artifact={artifact} />
        </div>
      </div>
    </div>
  )
}
