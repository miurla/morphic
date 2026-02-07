'use client'

import { UseChatHelpers } from '@ai-sdk/react'
import { AlertCircle, Check, ExternalLink, Globe } from 'lucide-react'

import { SearchResults as SearchResultsType } from '@/lib/types'
import type { ToolPart, UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import ProcessHeader from './process-header'

interface FetchSectionProps {
  tool: ToolPart<'fetch'>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  borderless?: boolean
  isFirst?: boolean
  isLast?: boolean
}

export function FetchSection({
  tool,
  isOpen, // Required by ToolSection interface
  onOpenChange, // Required by ToolSection interface
  status,
  borderless = false,
  isFirst = false,
  isLast = false
}: FetchSectionProps) {
  const url = tool.input?.url
  const isLoading = status === 'submitted' || status === 'streaming'
  const isToolLoading =
    tool.state === 'input-streaming' || tool.state === 'input-available'

  // Handle streaming output states
  const output = tool.state === 'output-available' ? tool.output : undefined
  const isFetching = output?.state === 'fetching'
  const fetchResults = output?.state === 'complete' ? output : undefined

  // Determine the status based on tool output availability
  let displayStatus: 'fetching' | 'success' | 'error' = 'fetching'
  let error: string | undefined
  let title: string | undefined
  let contentLength: number | undefined

  // Check tool state
  if (tool.state === 'output-error') {
    displayStatus = 'error'
    error = tool.errorText || 'Failed to retrieve content'
  } else if (!output || isFetching) {
    displayStatus = 'fetching'
  } else if (fetchResults) {
    // Success state - we have complete output
    const data = fetchResults as SearchResultsType
    if (data?.results?.[0]) {
      displayStatus = 'success'
      title = data.results[0].title
      contentLength = data.results[0].content?.length
    } else {
      displayStatus = 'error'
      error = 'No content retrieved'
    }
  }

  // Get page title for display
  const getPageTitle = () => {
    if (title) return title
    if (!url) return 'Unknown URL'
    try {
      const domain = new URL(url).hostname
      return domain.replace('www.', '')
    } catch {
      return url
    }
  }

  // Handle click to open URL
  const handleClick = () => {
    if (url && displayStatus === 'success') {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const header = (
    <ProcessHeader
      onInspect={handleClick}
      isLoading={isLoading && isToolLoading}
      label={
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate block min-w-0 max-w-full">
            {getPageTitle()}
          </span>
        </div>
      }
      meta={
        displayStatus === 'success' && contentLength ? (
          <>
            <Check size={16} className="text-green-500" />
            <span>
              {contentLength > 1000
                ? `${Math.round(contentLength / 1000)}k chars`
                : `${contentLength} chars`}
            </span>
          </>
        ) : displayStatus === 'error' ? (
          <>
            <AlertCircle size={16} className="text-destructive" />
            <span>{error}</span>
          </>
        ) : isToolLoading ? (
          <span className="animate-pulse">Retrieving...</span>
        ) : undefined
      }
      className={cn(
        displayStatus === 'success' && 'hover:text-foreground cursor-pointer'
      )}
    />
  )

  return (
    <div className="relative">
      {/* Rails for header - show based on position */}
      {borderless && (
        <>
          {!isFirst && (
            <div className="absolute left-[19.5px] w-px bg-border h-2 top-0" />
          )}
          {!isLast && (
            <div className="absolute left-[19.5px] w-px bg-border h-2 bottom-0" />
          )}
        </>
      )}
      {/* Header only section - no collapsible body */}
      <div
        className={cn(
          'rounded-lg',
          !borderless && 'bg-card border border-border'
        )}
      >
        <div className="flex items-center gap-2 p-3">
          <div className="flex-1 min-w-0">{header}</div>
          {displayStatus === 'success' && (
            <button
              type="button"
              onClick={handleClick}
              className="shrink-0 p-1 hover:bg-accent rounded transition-colors"
              aria-label="Open in new tab"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default FetchSection
