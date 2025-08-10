import type { ReasoningPart, TextPart } from '@ai-sdk/provider-utils'
import type { InferUITool, UIMessage as AIMessage } from 'ai'

import { fetchTool } from '@/lib/tools/fetch'
import { askQuestionTool } from '@/lib/tools/question'
import { searchTool } from '@/lib/tools/search'
import { createTodoTools, type TodoItem } from '@/lib/tools/todo'

// Re-export TodoItem for external use
export type { TodoItem }

// Define metadata type for messages
export interface UIMessageMetadata {
  traceId?: string
  feedbackScore?: number | null
  [key: string]: any
}

export type UIMessage<
  TMetadata = UIMessageMetadata,
  TDataTypes = UIDataTypes,
  TTools = UITools
> = AIMessage

export interface RelatedQuestionsData {
  status: 'loading' | 'success' | 'error'
  questions?: Array<{ question: string }>
}

export type UIDataTypes = {
  sources?: any[]
  relatedQuestions?: RelatedQuestionsData
}

// Data part types for DataSection
export type DataRelatedQuestionsPart = {
  type: 'data-relatedQuestions'
  id?: string
  data: RelatedQuestionsData
}

export type DataPart = DataRelatedQuestionsPart

// Create todo tools instance for type inference
const todoTools = createTodoTools()

export type UITools = {
  search: InferUITool<typeof searchTool>
  fetch: InferUITool<typeof fetchTool>
  askQuestion: InferUITool<typeof askQuestionTool>
  todoWrite: InferUITool<typeof todoTools.todoWrite>
  todoRead: InferUITool<typeof todoTools.todoRead>
  // Dynamic tools will be added at runtime
  [key: string]: any
}

export type ToolPart<T extends keyof UITools = keyof UITools> = {
  type: `tool-${T}`
  toolCallId: string
  input: UITools[T]['input']
  output?: UITools[T]['output']
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error'
  errorText?: string
}

export type Part = TextPart | ReasoningPart | ToolPart
