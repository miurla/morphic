'use client'

import type { UIMessage } from '@/lib/types/ai'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip'

interface Section {
  id: string
  userMessage: UIMessage
}

interface MessageNavigationDotsProps {
  sections: Section[]
}

function getUserMessagePreview(message: UIMessage): string {
  for (const part of message.parts ?? []) {
    if (part.type === 'text' && part.text) {
      const text = part.text.trim()
      return text.length > 20 ? `${text.slice(0, 20)}…` : text
    }
  }
  return ''
}

export function MessageNavigationDots({
  sections
}: MessageNavigationDotsProps) {
  const visibleSections = sections.slice(-4)

  const handleClick = (sectionId: string) => {
    const el = document.getElementById(`section-${sectionId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="absolute bottom-full right-0 z-20 mb-2 flex w-8 flex-col items-center gap-0 pb-2">
        {visibleSections.map(section => {
          const preview = getUserMessagePreview(section.userMessage)
          return (
            <Tooltip key={section.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="group flex size-3 items-center justify-center"
                  onClick={() => handleClick(section.id)}
                  aria-label={preview || 'Go to message'}
                >
                  <span className="size-1.5 rounded-full bg-foreground/30 transition-colors group-hover:bg-foreground/60" />
                </button>
              </TooltipTrigger>
              {preview && (
                <TooltipContent side="left" className="max-w-48 text-xs">
                  {preview}
                </TooltipContent>
              )}
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
