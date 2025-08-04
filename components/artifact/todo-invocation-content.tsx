'use client'

import { AlertCircle, Check } from 'lucide-react'

import { TodoItem } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

interface TodoInvocationContentProps {
  part: {
    type: 'tool-todoWrite' | 'tool-todoRead'
    toolCallId: string
    state:
      | 'input-streaming'
      | 'input-available'
      | 'output-available'
      | 'output-error'
    input?: { todos?: TodoItem[] }
    output?: {
      todos?: TodoItem[]
      message?: string
      completedCount?: number
      totalCount?: number
    }
    errorText?: string
  }
}

export function TodoInvocationContent({ part }: TodoInvocationContentProps) {
  const todos = part.output?.todos || part.input?.todos || []
  const completedCount =
    part.output?.completedCount ??
    todos.filter(t => t.status === 'completed').length
  const totalCount = part.output?.totalCount ?? todos.length

  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-600" />
      case 'in_progress':
        return (
          <div className="relative h-4 w-4 flex items-center justify-center">
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-ping absolute" />
            <div className="h-2 w-2 bg-blue-600 rounded-full" />
          </div>
        )
      default:
        return (
          <div className="h-4 w-4 flex items-center justify-center">
            <div className="h-2 w-2 bg-muted-foreground rounded-full" />
          </div>
        )
    }
  }

  if (part.state === 'output-error') {
    return (
      <div className="flex items-center gap-2 p-4 text-red-600">
        <AlertCircle className="size-4" />
        <span>Error: {part.errorText || 'Failed to process todos'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{part.output?.message || 'Todo List'}</span>
        <span className="font-medium whitespace-nowrap">
          ({completedCount}/{totalCount})
        </span>
      </div>

      {/* Todo List */}
      <div className="space-y-2">
        {todos.map((todo, index) => (
          <div
            key={todo.id || index}
            className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-2">
              {getStatusIcon(todo.status)}
              <p
                className={cn(
                  'text-sm',
                  todo.status === 'completed' && 'text-muted-foreground'
                )}
              >
                {todo.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {todos.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No todos available
        </div>
      )}
    </div>
  )
}
