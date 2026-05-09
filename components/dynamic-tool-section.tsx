'use client'

import { UseChatHelpers } from '@ai-sdk/react'
import {
  AlertCircle,
  Briefcase,
  Check,
  Loader2,
  MessageSquare,
  Plug,
  Send,
  Users
} from 'lucide-react'

import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import type { DynamicToolPart } from '@/lib/types/dynamic-tools'

import { MelronApplyResult } from './melron/melron-apply-result'
import { MelronJobSearchResult } from './melron/melron-job-search-result'
import { CollapsibleMessage } from './collapsible-message'
import ProcessHeader from './process-header'

interface DynamicToolSectionProps {
  tool: DynamicToolPart
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  borderless?: boolean
  isFirst?: boolean
  isLast?: boolean
}

// Pretty display names + icons for known melron tools.
// Anything not listed falls back to a generic icon and the raw tool name.
const TOOL_META: Record<string, { label: string; Icon: typeof Briefcase }> = {
  smart_job_search: { label: 'LinkedIn job search', Icon: Briefcase },
  smart_people_search: { label: 'LinkedIn people search', Icon: Users },
  smart_apply: { label: 'Apply to job', Icon: Send },
  smart_message: { label: 'Draft message', Icon: MessageSquare },
  smart_send: { label: 'Send message', Icon: Send },
  smart_fire: { label: 'Fire application', Icon: Send },
  smart_network_update: { label: 'Network update', Icon: Users },
  smart_post_planner: { label: 'Plan post', Icon: MessageSquare },
  smart_interest_map: { label: 'Interest map', Icon: Users }
}

// MCP tool outputs come back as `{ content: [{ type: 'text', text: '<json>' }] }`.
// We try to parse the JSON to render structured cards. Fail-soft: return null.
function extractMcpJson(output: unknown): unknown | null {
  if (!output || typeof output !== 'object') return null
  const content = (output as { content?: unknown }).content
  if (!Array.isArray(content) || content.length === 0) return null
  const first = content[0] as { type?: string; text?: string } | undefined
  if (first?.type !== 'text' || typeof first.text !== 'string') return null
  try {
    return JSON.parse(first.text)
  } catch {
    return null
  }
}

export function DynamicToolSection({
  tool,
  isOpen,
  onOpenChange,
  status,
  borderless = false
}: DynamicToolSectionProps) {
  const meta = TOOL_META[tool.toolName]
  const Icon = meta?.Icon ?? Plug
  const label = meta?.label ?? tool.toolName

  const isLoading = status === 'submitted' || status === 'streaming'
  const isToolLoading =
    tool.state === 'input-streaming' || tool.state === 'input-available'
  const isError = tool.state === 'output-error'
  const isComplete = tool.state === 'output-available'

  const parsed = isComplete ? extractMcpJson(tool.output) : null

  const header = (
    <ProcessHeader
      ariaExpanded={isOpen}
      isLoading={isLoading && isToolLoading}
      label={
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate block min-w-0 max-w-full">{label}</span>
        </div>
      }
      meta={
        isError ? (
          <>
            <AlertCircle size={14} className="text-destructive" />
            <span className="text-destructive">Failed</span>
          </>
        ) : isComplete ? (
          <Check size={14} className="text-green-500" />
        ) : isToolLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : null
      }
    />
  )

  // Specialized renderer per tool name. Falls back to raw JSON.
  const body = (() => {
    if (isError) {
      return (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
          {tool.errorText || 'Tool execution failed'}
        </div>
      )
    }
    if (!isComplete) {
      return (
        <div className="text-sm text-muted-foreground p-3">
          Running {label}…
        </div>
      )
    }
    if (tool.toolName === 'smart_job_search' && parsed) {
      return <MelronJobSearchResult data={parsed} />
    }
    if (tool.toolName === 'smart_apply' && parsed) {
      return <MelronApplyResult data={parsed} />
    }
    return (
      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
        <code>{JSON.stringify(parsed ?? tool.output, null, 2)}</code>
      </pre>
    )
  })()

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      header={header}
      showBorder={!borderless}
      showIcon={false}
      variant="minimal"
    >
      {body}
    </CollapsibleMessage>
  )
}
