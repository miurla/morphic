import type { Message } from 'ai'

export type UIMessage = Message

export type UIDataTypes = {
  sources?: any[]
}

export type UITools = {
  search: {
    input: {
      query: string
      max_results?: number
      search_depth?: 'basic' | 'advanced'
      include_domains?: string[]
      exclude_domains?: string[]
    }
    output: any
  }
  retrieve: {
    input: {
      url: string
    }
    output: any
  }
  videoSearch: {
    input: {
      query: string
    }
    output: any
  }
  askQuestion: {
    input: {
      question: string
      options: string[]
      allowMultiple?: boolean
    }
    output: any
  }
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