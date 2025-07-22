'use client'

import { UseChatHelpers } from '@ai-sdk/react'
import { ToolInvocation } from 'ai'

import { QuestionConfirmation } from './question-confirmation'
import { RelatedQuestions } from './related-questions'
import RetrieveSection from './retrieve-section'
import { SearchSection } from './search-section'
import { VideoSearchSection } from './video-search-section'

interface ToolSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  onQuerySelect: (query: string) => void
}

export function ToolSection({
  tool,
  isOpen,
  onOpenChange,
  status,
  addToolResult,
  onQuerySelect
}: ToolSectionProps) {
  // Special handling for ask_question tool
  if (tool.toolName === 'ask_question') {
    // When waiting for user input
    if (tool.state === 'call' && addToolResult) {
      return (
        <QuestionConfirmation
          toolInvocation={tool}
          onConfirm={(toolCallId, approved, response) => {
            addToolResult({
              toolCallId,
              result: approved
                ? response
                : {
                    declined: true,
                    skipped: response?.skipped,
                    message: 'User declined this question'
                  }
            })
          }}
        />
      )
    }

    // When result is available, display the result
    if (tool.state === 'result') {
      return (
        <QuestionConfirmation
          toolInvocation={tool}
          isCompleted={true}
          onConfirm={() => {}} // Not used in result display mode
        />
      )
    }
  }

  switch (tool.toolName) {
    case 'search':
      return (
        <SearchSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
        />
      )
    case 'videoSearch':
      return (
        <VideoSearchSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
        />
      )
    case 'retrieve':
      return (
        <RetrieveSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
        />
      )
    case 'related_questions':
      return (
        <RelatedQuestions
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
          onQuerySelect={onQuerySelect}
        />
      )
    default:
      return null
  }
}
