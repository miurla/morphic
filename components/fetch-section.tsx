'use client'

import { UseChatHelpers } from '@ai-sdk/react'

import { SearchResults as SearchResultsType } from '@/lib/types'
import type { ToolPart, UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'

import { FetchPreview } from './fetch-preview'

interface FetchSectionProps {
  tool: ToolPart<'fetch'>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
}

export function FetchSection({ tool }: FetchSectionProps) {
  const url = tool.input?.url

  // Determine the fetch type based on the tool input
  const fetchType =
    tool.input?.type === 'api' ? 'API Retrieve' : 'Regular Fetch'

  // Determine the status based on tool output availability
  let displayStatus: 'fetching' | 'success' | 'error' = 'fetching'
  let error: string | undefined
  let title: string | undefined
  let contentLength: number | undefined

  // Check if output is available
  if (!tool.output) {
    // Still fetching
    displayStatus = 'fetching'
  } else if (tool.state === 'output-error') {
    // Error state
    displayStatus = 'error'
    error = tool.errorText || 'Failed to retrieve content'
  } else {
    // Success state - we have output
    const data = tool.output as SearchResultsType
    if (data?.results?.[0]) {
      displayStatus = 'success'
      title = data.results[0].title
      contentLength = data.results[0].content?.length
    } else {
      displayStatus = 'error'
      error = 'No content retrieved'
    }
  }

  return (
    <div className="w-full">
      <FetchPreview
        url={url || ''}
        title={title}
        contentLength={contentLength}
        status={displayStatus}
        error={error}
        fetchType={fetchType}
      />
    </div>
  )
}

export default FetchSection
