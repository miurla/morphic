'use client'

import { UseChatHelpers } from '@ai-sdk/react'
import type { ToolPart, UIMessage, UIDataTypes, UITools } from '@/lib/types/ai'

import { QuestionConfirmation } from './question-confirmation'
import { RelatedQuestions } from './related-questions'
import RetrieveSection from './retrieve-section'
import { SearchSection } from './search-section'
import { VideoSearchSection } from './video-search-section'

interface ToolSectionProps {
  tool: ToolPart
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
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
  if (tool.type === 'tool-askQuestion') {
    // When waiting for user input
    if ((tool.state === 'input-streaming' || tool.state === 'input-available') && addToolResult) {
      return (
        <QuestionConfirmation
          toolInvocation={tool as ToolPart<'askQuestion'>}
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
    if (tool.state === 'output-available') {
      return (
        <QuestionConfirmation
          toolInvocation={tool as ToolPart<'askQuestion'>}
          isCompleted={true}
          onConfirm={() => {}} // Not used in result display mode
        />
      )
    }
  }

  switch (tool.type) {
    case 'tool-search':
      return (
        <SearchSection
          tool={tool as ToolPart<'search'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
        />
      )
    case 'tool-videoSearch':
      return (
        <VideoSearchSection
          tool={tool as ToolPart<'videoSearch'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
        />
      )
    case 'tool-retrieve':
      return (
        <RetrieveSection
          tool={tool as ToolPart<'retrieve'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
        />
      )
    case 'tool-relatedQuestions' as any:
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
