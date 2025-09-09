import { Check, ListTodo } from 'lucide-react'

import { Part, TodoItem } from '@/lib/types/ai'

import { useArtifact } from './artifact/artifact-context'
import { CollapsibleMessage } from './collapsible-message'
import ProcessHeader from './process-header'
import TodoListContent from './todo-list-content'

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
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ToolTodoDisplay({
  tool,
  state,
  output,
  toolCallId,
  isOpen = false,
  onOpenChange
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

  const openInspector = () => {
    if (!(state === 'output-available' && output)) return
    const partType = tool === 'todoWrite' ? 'tool-todoWrite' : 'tool-todoRead'
    const part: Part = {
      type: partType as 'tool-todoWrite' | 'tool-todoRead',
      toolCallId,
      state,
      input: { todos: output.todos || [] },
      output
    }
    openArtifact(part)
  }

  const header = (
    <ProcessHeader
      onInspect={openInspector}
      isLoading={isLoading}
      label={
        <span className="inline-flex items-center gap-2 min-w-0 overflow-hidden">
          <ListTodo className="size-4 text-muted-foreground shrink-0" />
          <span className="truncate">
            {state === 'output-available'
              ? tool === 'todoRead'
                ? (output as any)?.summary || output?.message || 'Todo list'
                : output?.message || 'Updated tasks'
              : tool === 'todoWrite'
                ? 'Updating tasks...'
                : 'Reading tasks...'}
          </span>
        </span>
      }
      meta={
        state === 'output-available' && totalCount > 0 ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            {completedCount === totalCount ? (
              <Check className="size-4 text-green-500" />
            ) : null}
            <span className="text-xs">
              ({completedCount}/{totalCount})
            </span>
          </span>
        ) : undefined
      }
      ariaExpanded={isOpen}
    />
  )

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showBorder={true}
      showIcon={false}
      variant="default"
      showSeparator={false}
    >
      {state === 'output-available' ? (
        <TodoListContent
          todos={output?.todos}
          message={
            tool === 'todoRead'
              ? (output as any)?.summary || output?.message
              : output?.message
          }
          completedCount={completedCount}
          totalCount={totalCount}
          showSummary={false}
          itemVariant="plain"
          className="pb-1"
        />
      ) : state === 'output-error' ? (
        <div className="px-3 pb-3 text-xs text-destructive">{`Todo tool failed${
          (output as any)?.message ? `: ${(output as any).message}` : ''
        }`}</div>
      ) : null}
    </CollapsibleMessage>
  )
}
