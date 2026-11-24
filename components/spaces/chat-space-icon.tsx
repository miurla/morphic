'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

import { useI18n } from '@/components/language-provider'

import { useChatSpace } from './chat-space-context'
import { DEFAULT_SPACE_COLOR, spaceLogoColor } from './space-colors'

/**
 * Renders an assistant logo in the chat's own space color (not the one
 * selected on the home), with the space name on hover for its owner.
 */
export function ChatSpaceIcon({
  children
}: {
  children: (bodyColor: string | undefined) => React.ReactElement
}) {
  const { t } = useI18n()
  const space = useChatSpace()
  const icon = children(space ? spaceLogoColor(space.color) : undefined)
  if (!space?.name) return icon
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0">{icon}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {space.color === DEFAULT_SPACE_COLOR ? t('Default') : space.name}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
