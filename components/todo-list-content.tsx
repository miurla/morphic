'use client'

import { AlertCircle, Check } from 'lucide-react'

import type { TodoItem } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

export type TodoListContentProps = {
  todos?: TodoItem[]
  message?: string
  summary?: string
  completedCount?: number
  totalCount?: number
  errorText?: string
  showSummary?: boolean
  itemVariant?: 'bordered' | 'plain'
  className?: string
}

export function TodoListContent({
  todos = [],
  message,
  summary,
  completedCount,
  totalCount,
  errorText,
  showSummary = true,
  itemVariant = 'bordered',
  className
}: TodoListContentProps) {
  const completed =
    completedCount ?? todos.filter(t => t.status === 'completed').length
  const total = totalCount ?? todos.length

  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
      case 'in_progress':
        return (
          <div className="relative h-4 w-4 flex items-center justify-center flex-shrink-0">
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-ping absolute" />
            <div className="h-2 w-2 bg-blue-600 rounded-full" />
          </div>
        )
      default:
        return (
          <div className="h-4 w-4 flex items-center justify-center flex-shrink-0">
            <div className="h-2 w-2 bg-muted-foreground rounded-full" />
          </div>
        )
    }
  }

  if (errorText) {
    return (
      <div className="flex items-center gap-2 p-4 text-red-600">
        <AlertCircle className="size-4" />
        <span>Error: {errorText}</span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showSummary && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{message || summary || 'Todo List'}</span>
          <span className="font-medium whitespace-nowrap">
            ({completed}/{total})
          </span>
        </div>
      )}

      <ul className="space-y-2">
        {todos.map((todo, index) => (
          <li key={todo.id || index}>
            <div
              className={cn(
                'flex items-center gap-2',
                itemVariant === 'bordered'
                  ? 'justify-between p-3 rounded-lg border bg-card'
                  : 'py-1'
              )}
            >
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
          </li>
        ))}
      </ul>

      {todos.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No todos available
        </div>
      )}
    </div>
  )
}

export default TodoListContent
