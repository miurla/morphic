'use client'

import { ArtifactContent } from '@/components/artifact/artifact-content'
import { useArtifact } from '@/components/artifact/artifact-context'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { TooltipButton } from '@/components/ui/tooltip-button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { LightbulbIcon, MessageSquare, Minimize2, Wrench } from 'lucide-react'

export function InspectorPanel() {
  const { state, close } = useArtifact()
  const part = state.part
  if (!part) return null

  // Get the icon and title based on part type
  const getIconAndTitle = () => {
    switch (part.type) {
      case 'tool-invocation':
        return {
          icon: <Wrench size={18} />,
          title: part.toolInvocation.toolName
        }
      case 'reasoning':
        return {
          icon: <LightbulbIcon size={18} />,
          title: 'Reasoning'
        }
      case 'text':
        return {
          icon: <MessageSquare size={18} />,
          title: 'Text'
        }
      default:
        return {
          icon: <MessageSquare size={18} />,
          title: 'Content'
        }
    }
  }

  const { icon, title } = getIconAndTitle()

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col overflow-hidden bg-muted md:px-4 md:pt-14 md:pb-4">
        <div className="flex flex-col h-full bg-background rounded-xl md:border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2">
            <h3 className="flex items-center gap-2">
              <div className="bg-muted p-2 rounded-md flex items-center gap-2">
                {icon}
              </div>
              <span className="text-sm font-medium capitalize">{title}</span>
            </h3>
            <TooltipButton
              variant="ghost"
              size="icon"
              onClick={close}
              aria-label="Close panel"
              tooltipContent="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </TooltipButton>
          </div>
          <Separator className="my-1 bg-border/50" />
          <div data-vaul-no-drag className="flex-1 overflow-y-auto p-4">
            <ArtifactContent part={part} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
