import { tool } from 'ai'
import { z } from 'zod'

// Todo item schema
export const todoItemSchema = z.object({
  id: z.string().describe('Unique identifier for the todo item'),
  content: z.string().describe('The task description'),
  status: z
    .enum(['pending', 'in_progress', 'completed'])
    .describe('Current status of the task'),
  priority: z
    .enum(['high', 'medium', 'low'])
    .default('medium')
    .describe('Priority level of the task'),
  timestamp: z.string().describe('ISO timestamp when the todo was created')
})

export type TodoItem = z.infer<typeof todoItemSchema>

// Schema for todo write tool
export const todoWriteInputSchema = z.object({
  todos: z.array(todoItemSchema).describe('The complete list of todos'),
  progressMessage: z
    .string()
    .optional()
    .describe('A brief message about the current progress')
})

// Schema for todo read tool
export const todoReadOutputSchema = z.object({
  todos: z.array(todoItemSchema),
  summary: z.string().describe('Summary of current progress'),
  completedCount: z.number(),
  totalCount: z.number()
})

// Create todo tools with session-scoped storage
export function createTodoTools() {
  // Session-scoped todos storage - isolated per tool instance
  let sessionTodos: TodoItem[] = []
  const todoWrite = tool({
    description:
      'Create or update todos to track progress on complex tasks. Use this to maintain a list of action items.',
    inputSchema: todoWriteInputSchema,
    execute: async ({ todos, progressMessage }) => {
      // Update session todos - ensure priority is always set
      sessionTodos = todos.map(todo => ({
        ...todo,
        priority: todo.priority || 'medium'
      }))

      // Calculate progress
      const completedCount = todos.filter(t => t.status === 'completed').length
      const totalCount = todos.length

      return {
        success: true,
        message: progressMessage || `Updated ${totalCount} todos`,
        completedCount,
        totalCount,
        todos: sessionTodos
      }
    }
  })

  const todoRead = tool({
    description: 'Read the current list of todos and their status',
    inputSchema: z.object({}),
    execute: async () => {
      const completedCount = sessionTodos.filter(
        (t: TodoItem) => t.status === 'completed'
      ).length
      const totalCount = sessionTodos.length

      return {
        todos: sessionTodos,
        summary:
          totalCount > 0
            ? `${completedCount} of ${totalCount} tasks completed`
            : 'No tasks created yet',
        completedCount,
        totalCount
      }
    }
  })

  return { todoWrite, todoRead }
}
