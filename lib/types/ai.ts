import type { UIMessage as AIMessage, InferUITool } from 'ai'
import { searchTool } from '@/lib/tools/search'
import { retrieveTool } from '@/lib/tools/retrieve'
import { videoSearchTool } from '@/lib/tools/video-search'
import { askQuestionTool } from '@/lib/tools/question'

export type UIMessage<TMetadata = unknown, TDataTypes = UIDataTypes, TTools = UITools> = AIMessage

export type UIDataTypes = {
  sources?: any[]
}

export type UITools = {
  search: InferUITool<typeof searchTool>
  retrieve: InferUITool<typeof retrieveTool>
  videoSearch: InferUITool<typeof videoSearchTool>
  askQuestion: InferUITool<typeof askQuestionTool>
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
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  errorText?: string
}

export type Part = TextPart | ReasoningPart | ToolPart