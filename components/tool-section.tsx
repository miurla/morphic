'use client'

import { UseChatHelpers } from '@ai-sdk/react'

import type { ToolPart, UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'

import FetchSection from './fetch-section'
import { QuestionConfirmation } from './question-confirmation'
import { SearchSection } from './search-section'
import { ToolTodoDisplay } from './tool-todo-display'

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
    if (
      (tool.state === 'input-streaming' || tool.state === 'input-available') &&
      addToolResult
    ) {
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
    case 'tool-fetch':
      return (
        <FetchSection
          tool={tool as ToolPart<'fetch'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
        />
      )
    case 'tool-todoWrite':
      return (
        <ToolTodoDisplay
          tool="todoWrite"
          state={tool.state}
          input={tool.input}
          output={tool.output}
          errorText={tool.errorText}
          toolCallId={tool.toolCallId}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'tool-todoRead':
      return (
        <ToolTodoDisplay
          tool="todoRead"
          state={tool.state}
          input={tool.input}
          output={tool.output}
          errorText={tool.errorText}
          toolCallId={tool.toolCallId}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    default:
      return null
  }
}
