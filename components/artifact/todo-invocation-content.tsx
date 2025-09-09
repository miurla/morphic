'use client'

import type { ToolPart } from '@/lib/types/ai'

import TodoListContent from '../todo-list-content'

interface TodoInvocationContentProps {
  part: ToolPart<'todoWrite'> | ToolPart<'todoRead'>
}

export function TodoInvocationContent({ part }: TodoInvocationContentProps) {
  const todos = part.output?.todos || part.input?.todos || []
  const completedCount = part.output?.completedCount
  const totalCount = part.output?.totalCount

  if (part.state === 'output-error') {
    return (
      <TodoListContent
        errorText={part.errorText || 'Failed to process todos'}
      />
    )
  }

  const summaryOrMessage =
    (part.output && 'message' in part.output && part.output.message) ||
    (part.output && 'summary' in part.output && part.output.summary) ||
    undefined

  return (
    <TodoListContent
      todos={todos}
      message={summaryOrMessage}
      completedCount={completedCount}
      totalCount={totalCount}
      showSummary={true}
      itemVariant="plain"
    />
  )
}
