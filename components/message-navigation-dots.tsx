'use client'

import { Briefcase, MessageSquare, Users } from 'lucide-react'

import type { UIMessage } from '@/lib/types/ai'

interface Section {
  id: string
  userMessage: UIMessage
  assistantMessages: UIMessage[]
}

interface MessageNavigationDotsProps {
  sections: Section[]
}

const TOOL_ICONS: Record<string, typeof Briefcase> = {
  smart_job_search: Briefcase,
  smart_people_search: Users,
  smart_apply: MessageSquare,
  smart_message: MessageSquare
}

function getUserMessagePreview(message: UIMessage): string {
  for (const part of message.parts ?? []) {
    if (part.type === 'text' && part.text) {
      const text = part.text.trim()
      return text.length > 24 ? `${text.slice(0, 24)}…` : text
    }
  }
  return ''
}

function getAgentIcon(section: Section): typeof Briefcase | null {
  for (const msg of section.assistantMessages ?? []) {
    for (const part of msg.parts ?? []) {
      if (
        part.type === 'dynamic-tool' &&
        part.state === 'output-available' &&
        TOOL_ICONS[part.toolName]
      ) {
        return TOOL_ICONS[part.toolName]
      }
    }
  }
  return null
}

export function MessageNavigationDots({
  sections
}: MessageNavigationDotsProps) {
  if (sections.length === 0) return null

  const handleClick = (sectionId: string) => {
    const el = document.getElementById(`section-${sectionId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="absolute -top-9 left-0 right-0 z-20 flex items-center gap-1 overflow-x-auto scrollbar-none px-1">
      {sections.map((section, i) => {
        const preview = getUserMessagePreview(section.userMessage)
        const AgentIcon = getAgentIcon(section)
        const num = i + 1

        return (
          <button
            key={section.id}
            type="button"
            className="group flex items-center gap-1 shrink-0 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => handleClick(section.id)}
            title={preview}
          >
            <span className="font-semibold text-foreground/60 group-hover:text-foreground">
              {num}
            </span>
            {AgentIcon && (
              <AgentIcon className="size-3 shrink-0 text-muted-foreground/70" />
            )}
            {preview && (
              <span className="truncate max-w-[100px]">{preview}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
