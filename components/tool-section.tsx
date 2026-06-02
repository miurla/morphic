'use client'

import { UseChatHelpers } from '@ai-sdk/react'

import type { ToolPart, UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'

import { FeedSection } from './feed-section'
import FetchSection from './fetch-section'
import { MapSection } from './map-section'
import { QuestionConfirmation } from './question-confirmation'
import { ResearchSubtaskSection } from './research-subtask-section'
import { SearchSection } from './search-section'
import { ToolTodoDisplay } from './tool-todo-display'

interface ToolSectionProps {
  tool: ToolPart
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  borderless?: boolean
  isFirst?: boolean
  isLast?: boolean
}

export function ToolSection({
  tool,
  isOpen,
  onOpenChange,
  status,
  addToolResult,
  borderless = false,
  isFirst = false,
  isLast = false
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
          borderless={borderless}
          isFirst={isFirst}
          isLast={isLast}
        />
      )
    case 'tool-feedSearch':
      return (
        <FeedSection
          tool={tool as ToolPart<'feedSearch'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          borderless={borderless}
          isFirst={isFirst}
          isLast={isLast}
        />
      )
    case 'tool-fetch':
      return (
        <FetchSection
          tool={tool as ToolPart<'fetch'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
          borderless={borderless}
          isFirst={isFirst}
          isLast={isLast}
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
          borderless={borderless}
          isFirst={isFirst}
          isLast={isLast}
        />
      )
    case 'tool-researchSubtask':
      return (
        <ResearchSubtaskSection
          tool={tool as ToolPart<'researchSubtask'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          borderless={borderless}
          isFirst={isFirst}
          isLast={isLast}
        />
      )
    case 'tool-mapSearch': {
      const mInput = tool.input as any
      const mOutput = tool.output as any
      const isDone = tool.state === 'output-available'

      return (
        <MapSection
          state={isDone ? 'complete' : 'searching'}
          action={isDone ? mOutput?.action : mInput?.action}
          provider={isDone ? mOutput?.provider : mInput?.provider}
          query={isDone ? mOutput?.query : mInput?.query}
          places={isDone ? mOutput?.places : undefined}
          origin={isDone ? mOutput?.origin : mInput?.origin}
          destination={isDone ? mOutput?.destination : mInput?.destination}
          directions={isDone ? mOutput?.directions : undefined}
        />
      )
    }
    default:
      return null
  }
}
