'use client'

import { Briefcase, MessageSquare, Users } from 'lucide-react'

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
  assistantMessages: UIMessage[]
}

const TOOL_ICONS: Record<string, typeof Briefcase> = {
  smart_job_search: Briefcase,
  smart_people_search: Users,
  smart_apply: MessageSquare,
  smart_message: MessageSquare
}

const TOOL_LABELS: Record<string, string> = {
  smart_job_search: 'Jobs',
  smart_people_search: 'Profils',
  smart_apply: 'Candidature',
  smart_message: 'Message'
}

type AgentAnchor = {
  sectionId: string
  toolName: string
  label: string
  Icon: typeof Briefcase
}

function extractAgentAnchors(sections: Section[]): AgentAnchor[] {
  const anchors: AgentAnchor[] = []

  for (const section of sections) {
    for (const msg of section.assistantMessages) {
      for (const part of msg.parts ?? []) {
        if (
          part.type === 'dynamic-tool' &&
          part.state === 'output-available' &&
          TOOL_LABELS[part.toolName]
        ) {
          anchors.push({
            sectionId: section.id,
            toolName: part.toolName,
            label: TOOL_LABELS[part.toolName],
            Icon: TOOL_ICONS[part.toolName] ?? Briefcase
          })
        }
      }
    }
  }

  return anchors.slice(-6)
}

export function AgentResultAnchors({
  sections
}: {
  sections: Section[]
}) {
  const anchors = extractAgentAnchors(sections)
  if (anchors.length === 0) return null

  return (
    <TooltipProvider delayDuration={200}>
      <div className="absolute bottom-full left-0 z-20 mb-2 flex w-8 flex-col items-center gap-1 pb-2">
        {anchors.map((anchor, i) => {
          const Icon = anchor.Icon
          return (
            <Tooltip key={`${anchor.sectionId}-${anchor.toolName}-${i}`}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="group flex size-6 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-accent"
                  onClick={() => {
                    const el = document.getElementById(
                      `section-${anchor.sectionId}`
                    )
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  aria-label={`Go to ${anchor.label}`}
                >
                  <Icon className="size-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {anchor.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
