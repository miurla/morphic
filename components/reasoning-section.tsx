'use client'

import { useEffect, useState } from 'react'

import type { ReasoningPart } from '@ai-sdk/provider-utils'

import { useArtifact } from '@/components/artifact/artifact-context'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { MarkdownMessage } from './message'
import ProcessHeader from './process-header'

interface ReasoningContent {
  reasoning: string
  isDone: boolean
}

export interface ReasoningSectionProps {
  content: ReasoningContent
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ReasoningSection({
  content,
  isOpen,
  onOpenChange
}: ReasoningSectionProps) {
  const { open } = useArtifact()
  // Show a short preview when collapsed; switch to a generic label when expanded
  const HEADER_PREVIEW_CHARS = 120
  const SANITIZE_MARKDOWN_PREVIEW = true
  const [preview, setPreview] = useState<string | null>(null)

  const toPreview = (text: string) => {
    const firstLine = (text || '').split(/\r?\n/)[0] || ''
    if (!SANITIZE_MARKDOWN_PREVIEW) return firstLine
    return firstLine
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // links [text](url)
      .replace(/`([^`]+)`/g, '$1') // inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1') // bold **text**
      .replace(/__([^_]+)__/g, '$1') // bold __text__
      .replace(/^#{1,6}\s*/, '') // heading markers at start
  }

  // Lock a preview during streaming to avoid frequent churn; refresh once when done
  useEffect(() => {
    const text = content?.reasoning || ''
    if (!text) return
    const prepared = toPreview(text)
    if (!content.isDone) {
      // Set once during streaming
      if (!preview) setPreview(prepared.slice(0, HEADER_PREVIEW_CHARS))
    } else {
      // On completion, ensure preview reflects the final string (single update)
      const finalPreview = prepared.slice(0, HEADER_PREVIEW_CHARS)
      if (preview !== finalPreview) setPreview(finalPreview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.reasoning, content.isDone])

  const headerLabel = isOpen
    ? 'Thoughts'
    : preview && preview.length > 0
      ? preview
      : !content.isDone
        ? 'Thinking...'
        : 'Thoughts'

  const reasoningHeader = (
    <ProcessHeader
      label={headerLabel}
      onInspect={() =>
        open({ type: 'reasoning', text: content.reasoning } as ReasoningPart)
      }
      isLoading={!content.isDone}
      ariaExpanded={isOpen}
    />
  )

  if (!content) return <DefaultSkeleton />

  // Return null if done and reasoning text is empty
  if (content.isDone && !content.reasoning?.trim()) return null

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={reasoningHeader}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showBorder={true}
      showIcon={false}
      variant="default"
      showSeparator={false}
    >
      <div className="[&_p]:text-xs [&_p]:text-muted-foreground/80">
        <MarkdownMessage message={content.reasoning} />
      </div>
    </CollapsibleMessage>
  )
}
