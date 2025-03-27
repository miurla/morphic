'use client'

import { ToolInvocation } from 'ai'
import { QuestionConfirmation } from './question-confirmation'
import RetrieveSection from './retrieve-section'
import { SearchSection } from './search-section'
import { VideoSearchSection } from './video-search-section'

interface ToolSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  addToolResult?: (params: { toolCallId: string; result: any }) => void
}

export function ToolSection({
  tool,
  isOpen,
  onOpenChange,
  addToolResult
}: ToolSectionProps) {
  // Special handling for ask_question tool
  if (
    tool.toolName === 'ask_question' &&
    tool.state === 'call' &&
    addToolResult
  ) {
    return (
      <QuestionConfirmation
        toolInvocation={tool}
        onConfirm={(toolCallId, approved) => {
          // If approved, return the original args so the question can be displayed
          // If declined, return a message that the user declined
          addToolResult({
            toolCallId,
            result: approved
              ? tool.args
              : { declined: true, message: 'User declined this question' }
          })
        }}
      />
    )
  }

  switch (tool.toolName) {
    case 'search':
      return (
        <SearchSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'video_search':
      return (
        <VideoSearchSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'retrieve':
      return (
        <RetrieveSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    default:
      return null
  }
}
