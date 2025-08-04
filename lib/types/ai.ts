import type { InferUITool, UIMessage as AIMessage } from 'ai'

import { fetchTool } from '@/lib/tools/fetch'
import { askQuestionTool } from '@/lib/tools/question'
import { searchTool } from '@/lib/tools/search'
import { type TodoItem } from '@/lib/tools/todo'

// Re-export TodoItem for external use
export type { TodoItem }

export type UIMessage<
  TMetadata = unknown,
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

export type UITools = {
  search: InferUITool<typeof searchTool>
  fetch: InferUITool<typeof fetchTool>
  askQuestion: InferUITool<typeof askQuestionTool>
  // Dynamic tools will be added at runtime
  [key: string]: any
}

export type TextPart = {
  type: 'text'
  text: string
}

export type ReasoningPart = {
  type: 'reasoning'
  text: string
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

// Extended tool parts for specific tools
export type TodoToolPart = {
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

export type Part = TextPart | ReasoningPart | ToolPart | TodoToolPart
