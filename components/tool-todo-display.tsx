import { Check, ListTodo } from 'lucide-react'

import { TodoItem } from '@/lib/types/ai'

import { useArtifact } from './artifact/artifact-context'

interface ToolTodoDisplayProps {
  tool: 'todoWrite' | 'todoRead'
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error'
  input?: {
    todos?: TodoItem[]
  }
  output?: {
    todos?: TodoItem[]
    message?: string
    completedCount?: number
    totalCount?: number
  }
  errorText?: string
  toolCallId: string
}

export function ToolTodoDisplay({
  tool,
  state,
  output,
  toolCallId
}: ToolTodoDisplayProps) {
  const { open: openArtifact } = useArtifact()
  // Calculate counts for display
  const completedCount =
    output?.completedCount ??
    (output?.todos
      ? output.todos.filter(t => t.status === 'completed').length
      : 0)
  const totalCount =
    output?.totalCount ?? (output?.todos ? output.todos.length : 0)

  const isLoading = state === 'input-streaming' || state === 'input-available'

  const handleClick = () => {
    if (state === 'output-available' && output) {
      openArtifact({
        type:
          tool === 'todoWrite' ? 'tool-todoWrite' : ('tool-todoRead' as any),
        toolCallId: toolCallId,
        state: state as any,
        input: { todos: output.todos || [] },
        output: output
      })
    }
  }

  return (
    <div
      className={`rounded-lg border bg-card ${isLoading ? 'animate-pulse' : ''} ${
        state === 'output-available' && output
          ? 'cursor-pointer hover:bg-accent/50 transition-colors'
          : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <ListTodo className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {state === 'output-available'
              ? output?.message || 'Todo list updated'
              : tool === 'todoWrite'
                ? 'Updating tasks...'
                : 'Reading tasks...'}
          </span>
        </div>
        {state === 'output-available' && totalCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {completedCount === totalCount && (
              <Check className="size-4 text-green-500" />
            )}
            ({completedCount}/{totalCount})
          </span>
        )}
      </div>
    </div>
  )
}
